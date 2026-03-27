package files

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

type iniSections map[string]map[string]string

func parseINI(path string) (iniSections, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	sections := iniSections{}
	currentSection := ""

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ";") || strings.HasPrefix(line, "#") {
			continue
		}

		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			currentSection = strings.TrimSuffix(strings.TrimPrefix(line, "["), "]")
			if _, exists := sections[currentSection]; !exists {
				sections[currentSection] = map[string]string{}
			}
			continue
		}

		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}

		if _, exists := sections[currentSection]; !exists {
			sections[currentSection] = map[string]string{}
		}

		sections[currentSection][strings.TrimSpace(key)] = strings.TrimSpace(value)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return sections, nil
}

func iniValue(sections iniSections, section string, key string) string {
	if sectionValues, exists := sections[section]; exists {
		return sectionValues[key]
	}
	return ""
}

func parseBool(value string) bool {
	return strings.EqualFold(value, "true")
}

func parseInt(value string) int {
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return parsed
}
