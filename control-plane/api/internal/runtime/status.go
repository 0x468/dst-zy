package runtime

import "encoding/json"

type ServiceStatus struct {
	Name    string `json:"name"`
	Service string `json:"service"`
	State   string `json:"state"`
}

func ParseComposePSJSON(raw []byte) ([]ServiceStatus, error) {
	var statuses []ServiceStatus
	if err := json.Unmarshal(raw, &statuses); err != nil {
		return nil, err
	}
	return statuses, nil
}
