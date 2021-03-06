const createPostgresApi = require('./lib/postgres-driver');
const createMemApi = require('./lib/in-memory-driver');
const configureCreateSubscription = require('./lib/subscribe');

const createMessageStore = ({ clientId, driver, connectionString, logLevel }) => {
    let api;

    console.debug('message store is using driver: ' + driver);

    if (driver === 'postgres') {
        api = createPostgresApi({ connectionString, logLevel, clientId });
    } else if (driver == 'in-memory') {
        api = createMemApi({ connectionString, logLevel, clientId });
    } else {
        throw new Error(`Unsupported driver type: ${driver}. Use one of ['postgres', 'in-memory'].`);
    }

    const createSubscription = configureCreateSubscription({
        read: api.read,
        readLastMessage: api.readLast,
        write: api.write,
    });

    return {
        createSubscription,
        write: api.write,
        deleteById: api.delete,
        read: api.read,
        readByType: api.readByType,
        readByEntityId: api.readByEntityId,
        readByMetadataAttribute: api.readByMetadataAttribute,
        readById: api.readById,
        project: api.project,
    };
};

module.exports = createMessageStore;
