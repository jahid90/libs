const express = require('express');

const createHandlers = ({ store }) => {
    const handleViewAllEvents = (req, res) => {
        const event = {
            type: 'ViewAllEventsRequest',
            streamName: 'esdb-requests',
            data: {
                requestAt: Date.now(),
            },
            metadata: {
                traceId: req.context.requestId,
            },
        };

        if (req.query.full !== undefined) {
            return store
                .addEvent(event)
                .catch((err) => console.error(err.message))
                .then(() => store.getAllEvents())
                .then((ids) => Promise.all(ids.map((id) => store.getEventDetail({ id }))))
                .then((events) => res.json(events));
        }

        return store
            .addEvent(event)
            .catch((err) => console.error(err.message))
            .then(() => store.getAllEvents())
            .then((ids) => res.json(ids));
    };

    const handleViewEvent = (req, res) => {
        const { id } = req.params;

        const event = {
            type: 'ViewEventRequest',
            streamName: 'esdb-requests',
            data: {
                requestAt: Date.now(),
                id,
            },
            metadata: {
                traceId: req.context.requestId,
            },
        };

        return store
            .addEvent(event)
            .catch((err) => console.error(err.message))
            .then(() => store.getEventDetail({ id }))
            .then((event) => res.json(event));
    };

    return {
        handleViewAllEvents,
        handleViewEvent,
    };
};

const createDbApp = ({ store }) => {
    const handlers = createHandlers({ store });
    const router = express.Router();

    router.get('/events', handlers.handleViewAllEvents);
    router.get('/events/:id', handlers.handleViewEvent);

    return router;
};

module.exports = createDbApp;
