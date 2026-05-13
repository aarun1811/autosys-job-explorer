package com.citi.gru.rectrace.config;

import brave.propagation.B3Propagation;
import brave.propagation.Propagation;
import brave.propagation.TraceContext;
import brave.propagation.TraceContextOrSamplingFlags;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

@Configuration
@Profile("!test")
public class CorrelationIdPropagationConfig {

    private static final String HEADER = "X-Correlation-Id";
    private static final Pattern HEX32 = Pattern.compile("^[a-fA-F0-9]{32}$");

    /**
     * Registers a custom Brave Propagation.Factory that reads the X-Correlation-Id
     * HTTP header and adopts it as the backend's 128-bit traceId (D-2.10).
     *
     * A UUID v4 with dashes stripped is exactly 32 hex chars — a valid W3C traceparent
     * 128-bit traceId. This means the X-Correlation-Id the user sees in error UI
     * IS the backend's traceId: single ID end-to-end, no two-IDs-for-one-request confusion.
     *
     * Security: the 32-hex regex in extractor() is the validation boundary for T-2-02.
     * Header values that fail the regex (including log-injection strings like "foo\n[...]")
     * are rejected — Brave falls back to B3 extraction instead.
     *
     * inject(): echoes X-Correlation-Id on outbound calls (lowercase hex of traceId)
     * AND writes B3 downstream headers via the delegate.
     *
     * Brave 5.12+ uses Propagation.Factory.get() returning Propagation<String> directly;
     * the legacy create(KeyFactory) overload is removed and throws at runtime.
     *
     * Phase 7 OBS-01 owns the full observability pipeline (exporters, structured logs).
     * Phase 2 scope: MDC population only, no Zipkin/Jaeger/OTel exporter.
     *
     * Decision refs: D-2.9, D-2.10, D-2.12
     */
    @Bean
    public Propagation.Factory correlationIdPropagationFactory() {
        return new Propagation.Factory() {
            @Override
            public Propagation<String> get() {
                final Propagation<String> delegate = B3Propagation.FACTORY.get();
                return new Propagation<String>() {
                    @Override
                    public List<String> keys() {
                        List<String> all = new ArrayList<>(delegate.keys());
                        all.add(HEADER);
                        return all;
                    }

                    @Override
                    public <R> TraceContext.Injector<R> injector(Propagation.Setter<R, String> setter) {
                        // Inject B3 downstream AND echo X-Correlation-Id (lowercase hex of traceId)
                        return (traceContext, carrier) -> {
                            delegate.injector(setter).inject(traceContext, carrier);
                            String hex = traceContext.traceIdString();
                            if (hex != null && hex.length() == 32) {
                                setter.put(carrier, HEADER, hex);
                            }
                        };
                    }

                    @Override
                    public <R> TraceContext.Extractor<R> extractor(Propagation.Getter<R, String> getter) {
                        return carrier -> {
                            String raw = getter.get(carrier, HEADER);
                            if (raw != null && HEX32.matcher(raw).matches()) {
                                String hex = raw.toLowerCase();
                                long hi = Long.parseUnsignedLong(hex.substring(0, 16), 16);
                                long lo = Long.parseUnsignedLong(hex.substring(16), 16);
                                // Random spanId distinct from traceId low bits — spanId == traceId-low
                                // violates W3C traceparent uniqueness and creates self-referencing
                                // cycles in Zipkin/Jaeger UIs when export ships in Phase 7 (OBS-01).
                                long spanId = ThreadLocalRandom.current().nextLong();
                                TraceContext ctx = TraceContext.newBuilder()
                                    .traceIdHigh(hi).traceId(lo)
                                    .spanId(spanId)
                                    .sampled(true)
                                    .build();
                                return TraceContextOrSamplingFlags.create(ctx);
                            }
                            return delegate.extractor(getter).extract(carrier);
                        };
                    }
                };
            }
        };
    }
}
