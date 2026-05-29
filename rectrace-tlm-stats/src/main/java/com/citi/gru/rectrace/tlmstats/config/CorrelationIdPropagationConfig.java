package com.citi.gru.rectrace.tlmstats.config;

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
     * Mirror of backend/rectrace's CorrelationIdPropagationConfig. A shared-ops lib
     * would deduplicate this; deferred per CONTEXT.md.
     *
     * Brave 5.12+ uses Propagation.Factory.get() returning Propagation<String> directly;
     * the legacy create(KeyFactory) overload is removed and throws at runtime.
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
