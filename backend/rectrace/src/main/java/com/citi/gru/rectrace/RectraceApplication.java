package com.citi.gru.rectrace;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication(exclude = { DataSourceAutoConfiguration.class, JpaRepositoriesAutoConfiguration.class })
@EnableAsync
public class RectraceApplication {

	public static void main(String[] args) {
		SpringApplication.run(RectraceApplication.class, args);
	}

}
