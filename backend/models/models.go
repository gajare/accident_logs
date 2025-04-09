package models

type AccidentLog struct {
	ID              int    `json:"id"`
	Comments        string `json:"comments"`
	Date            string `json:"date"`
	Datetime        string `json:"datetime"`
	InvolvedCompany string `json:"involved_company"`
	InvolvedName    string `json:"involved_name"`
	TimeHour        int    `json:"time_hour"`
	TimeMinute      int    `json:"time_minute"`
}
