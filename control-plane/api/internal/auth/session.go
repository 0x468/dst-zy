package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

var (
	ErrInvalidSessionToken = errors.New("invalid session token")
	ErrExpiredSessionToken = errors.New("expired session token")
)

type Session struct {
	Username  string    `json:"username"`
	ExpiresAt time.Time `json:"expires_at"`
}

func IssueSessionToken(username string, now time.Time, ttl time.Duration, secret []byte) (string, error) {
	if username == "" {
		return "", errors.New("username must not be empty")
	}
	if len(secret) == 0 {
		return "", errors.New("secret must not be empty")
	}

	session := Session{
		Username:  username,
		ExpiresAt: now.UTC().Add(ttl),
	}

	payload, err := json.Marshal(session)
	if err != nil {
		return "", err
	}

	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	signature := signSessionPayload(payload, secret)
	encodedSignature := base64.RawURLEncoding.EncodeToString(signature)

	return encodedPayload + "." + encodedSignature, nil
}

func ParseSessionToken(token string, now time.Time, secret []byte) (Session, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return Session{}, ErrInvalidSessionToken
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return Session{}, ErrInvalidSessionToken
	}

	signature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Session{}, ErrInvalidSessionToken
	}

	expected := signSessionPayload(payload, secret)
	if subtle.ConstantTimeCompare(signature, expected) != 1 {
		return Session{}, ErrInvalidSessionToken
	}

	var session Session
	if err := json.Unmarshal(payload, &session); err != nil {
		return Session{}, ErrInvalidSessionToken
	}

	if !session.ExpiresAt.After(now.UTC()) {
		return Session{}, ErrExpiredSessionToken
	}

	return session, nil
}

func signSessionPayload(payload []byte, secret []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	mac.Write(payload)
	return mac.Sum(nil)
}
