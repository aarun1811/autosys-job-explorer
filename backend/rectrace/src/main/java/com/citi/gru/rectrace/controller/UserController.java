package com.citi.gru.rectrace.controller;

import javax.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.citi.gru.rectrace.dto.UserInfoDTO;

@RestController
@RequestMapping("/api/user")
public class UserController {

    private static final Logger logger = LoggerFactory.getLogger(UserController.class);

    private static final String CITI_PORTAL_LOGIN_ID_HEADER = "x-citiportal-loginid";

    @GetMapping("/info")
    public ResponseEntity<UserInfoDTO> getUserInfo(HttpServletRequest request) {
        String loginId = request.getHeader(CITI_PORTAL_LOGIN_ID_HEADER);
        logger.info("App loaded by user: {}", loginId);
        if (loginId == null || loginId.isEmpty()) {
            return ResponseEntity.ok(new UserInfoDTO(null));
        }

        return ResponseEntity.ok(new UserInfoDTO(loginId));
    }
}
