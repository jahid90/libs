const { trace } = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
const { HttpInstrumentation } = require("@opentelemetry/instrumentation-http");
const { GrpcInstrumentation } = require("@opentelemetry/instrumentation-grpc");

const uris = require('./config/uris');
const constants = require('./config/constants');

if (constants.EnableLogTraceToConsole) {
    const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL);
}

const provider = new NodeTracerProvider({
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: constants.SERVICE_NAME,
    })
});

provider.addSpanProcessor(
    new SimpleSpanProcessor(
        new ZipkinExporter({
            url: uris.ZIPKIN_URI
        })
    )
);

const init = () => {
    provider.register();

    registerInstrumentations({
        instrumentations: [
            new HttpInstrumentation(),
            new GrpcInstrumentation(),
        ],
    });
}

const tracer = trace.getTracer(constants.SERVICE_NAME);

const trace = (cb, label) => {
    return () => {

        // Start the instrumentation
        const span = tracer.startSpan(label);
        
        // Invoke the function
        const result = cb.apply(this, arguments);
        
        // End the instrumentation
        span.end();

        // Return the result
        return result;
    };
} 

module.exports = {
    trace,
    // Call this before starting the express server
    init
};