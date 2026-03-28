package apierror

import "errors"

type Kind string

const (
	KindInvalid  Kind = "invalid"
	KindNotFound Kind = "not_found"
)

type Error struct {
	Kind    Kind
	Message string
	Err     error
}

func (e *Error) Error() string {
	if e.Message != "" {
		return e.Message
	}
	if e.Err != nil {
		return e.Err.Error()
	}

	return string(e.Kind)
}

func (e *Error) Unwrap() error {
	return e.Err
}

func Invalid(message string, err error) error {
	return &Error{
		Kind:    KindInvalid,
		Message: message,
		Err:     err,
	}
}

func NotFound(message string, err error) error {
	return &Error{
		Kind:    KindNotFound,
		Message: message,
		Err:     err,
	}
}

func IsKind(err error, kind Kind) bool {
	var target *Error
	return errors.As(err, &target) && target.Kind == kind
}

func Message(err error) string {
	var target *Error
	if errors.As(err, &target) && target.Message != "" {
		return target.Message
	}
	if err == nil {
		return ""
	}

	return err.Error()
}
