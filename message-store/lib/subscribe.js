const Bluebird = require('bluebird');
const { v4: uuid } = require('uuid');

const category = require('./category');

const configureCreateSubscription = ({ read, readLastMessage, write }) => {
    return ({
        streamName,
        handlers,
        messagesPerTick = 100,
        subscriberId,
        positionUpdateInterval = 100,
        originStreamName = null,
        tickIntervalMs = 10 * 1000,
    }) => {
        const subscriberPositionStreamName = `subscriberPosition-${subscriberId}`;

        let currentPosition = 0;
        let messagesSinceLastPositionWrite = 0;
        let keepGoing = true;

        const loadPosition = () => {
            return readLastMessage(subscriberPositionStreamName)
                .then((message) => (currentPosition = message ? message.data.position : 0))
                .catch((err) => console.error(err.message));
        };

        const updateReadPosition = (position, messageId) => {
            if (currentPosition >= position) {
                console.warn(
                    `updating position backwards - was :${currentPosition}, now is: ${position} for [${subscriberPositionStreamName}]`
                );
            }

            currentPosition = position;
            messagesSinceLastPositionWrite += 1;

            if (messagesSinceLastPositionWrite >= positionUpdateInterval) {
                messagesSinceLastPositionWrite = 0;

                return writePosition(currentPosition, messageId);
            }

            return Bluebird.resolve(true);
        };

        const writePosition = (position, messageId) => {
            const positionEvent = {
                id: uuid(),
                type: 'Read',
                data: {
                    position,
                    lastMessageId: messageId,
                },
            };

            return write(subscriberPositionStreamName, positionEvent).catch((err) => console.error(err.message));
        };

        const filterOnOriginMatch = (messages) => {
            if (!originStreamName) {
                return messages;
            }

            return messages.filter((message) => {
                const originCategory = message.metadata && category(message.metadata.originStreamName);

                return originStreamName === originCategory;
            });
        };

        const getNextBatchOfMessages = () => {
            return read(streamName, currentPosition + 1, messagesPerTick)
                .then(filterOnOriginMatch)
                .catch((err) => {
                    console.error(err.message);
                    return [];
                });
        };

        const processBatch = (messages) => {
            return Bluebird.each(messages, (message) => {
                return handleMessage(message)
                    .then(() => updateReadPosition(message.globalPosition, message.id))
                    .catch((err) => {
                        logError(message, err);
                        throw err;
                    });
            }).then(() => messages.length);
        };

        const handleMessage = (message) => {
            const handler = handlers[message.type] || handlers.$any;
            return handler ? handler(message) : Promise.resolve(true);
        };

        const logError = (lastMessage, error) => {
            console.error('error processing:\n', `\t${subscriberId}\n`, `\t${lastMessage.id}\n`, `\t${error}\n`);
        };

        const start = () => {
            console.log(`Started ${subscriberId}`);

            return poll();
        };

        const stop = () => {
            console.log(`Stopped ${subscriberId}`);

            keepGoing = false;

            return Bluebird.resolve(true);
        };

        const poll = async () => {
            await loadPosition();

            while (keepGoing) {
                const messagesProcessed = await tick();

                if (messagesProcessed === 0) {
                    await Bluebird.delay(tickIntervalMs);
                }
            }

            return Bluebird.resolve(true);
        };

        const tick = () => {
            return getNextBatchOfMessages()
                .then(processBatch)
                .catch((err) => {
                    console.error('Error processing batch', err);

                    stop();
                });
        };

        return {
            loadPosition,
            start,
            stop,
            tick,
            writePosition,
        };
    };
};

module.exports = configureCreateSubscription;
