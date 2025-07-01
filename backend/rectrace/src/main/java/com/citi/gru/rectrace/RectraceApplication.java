package com.citi.gru.rectrace;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class RectraceApplication {

	public static void main(String[] args) {
		SpringApplication.run(RectraceApplication.class, args);
	}

}
