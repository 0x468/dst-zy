package service

import "context"

type StaticAuthService struct {
	Username string
	Password string
}

func (s StaticAuthService) Authenticate(_ context.Context, username string, password string) (bool, error) {
	return username == s.Username && password == s.Password, nil
}
