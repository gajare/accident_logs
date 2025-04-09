package handlers

import (
	"bytes"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
)

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

func GetAccidentLogs(c *gin.Context) {
	// Get access token from header
	accessToken := c.GetHeader("Authorization")
	if accessToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
		return
	}

	// Get project ID and company ID from environment variables
	projectID := os.Getenv("PROCORE_PROJECT_ID")
	companyID := os.Getenv("PROCORE_COMPANY_ID")

	// Create request
	req, err := http.NewRequest("GET", "https://sandbox.procore.com/rest/v1.0/projects/"+projectID+"/accident_logs", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Set headers
	req.Header.Set("Authorization", accessToken)
	req.Header.Set("Procore-Company-Id", companyID)

	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Forward the response
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}

func CreateAccidentLog(c *gin.Context) {
	// Get access token from header
	accessToken := c.GetHeader("Authorization")
	if accessToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
		return
	}

	// Parse request body
	var logData AccidentLog
	if err := c.ShouldBindJSON(&logData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get project ID and company ID from environment variables
	projectID := os.Getenv("PROCORE_PROJECT_ID")
	companyID := os.Getenv("PROCORE_COMPANY_ID")

	// Prepare form data
	formData := make(map[string]string)
	formData["accident_log[comments]"] = logData.Comments
	formData["accident_log[date]"] = logData.Date
	formData["accident_log[datetime]"] = logData.Datetime
	formData["accident_log[involved_company]"] = logData.InvolvedCompany
	formData["accident_log[involved_name]"] = logData.InvolvedName
	formData["accident_log[time_hour]"] = strconv.Itoa(logData.TimeHour)
	formData["accident_log[time_minute]"] = strconv.Itoa(logData.TimeMinute)

	// Convert form data to URL-encoded format
	values := url.Values{}
	for key, value := range formData {
		values.Add(key, value)
	}

	// Create request
	req, err := http.NewRequest("POST", "https://sandbox.procore.com/rest/v1.0/projects/"+projectID+"/accident_logs", bytes.NewBufferString(values.Encode()))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Set headers
	req.Header.Set("Authorization", accessToken)
	req.Header.Set("Procore-Company-Id", companyID)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Forward the response
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}

func DeleteAccidentLog(c *gin.Context) {
	// Get access token from header
	accessToken := c.GetHeader("Authorization")
	if accessToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
		return
	}

	// Get log ID from URL parameter
	logID := c.Param("id")
	if logID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Log ID is required"})
		return
	}

	// Get project ID and company ID from environment variables
	projectID := os.Getenv("PROCORE_PROJECT_ID")
	companyID := os.Getenv("PROCORE_COMPANY_ID")

	// Create request
	req, err := http.NewRequest("DELETE", "https://sandbox.procore.com/rest/v1.0/projects/"+projectID+"/accident_logs/"+logID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Set headers
	req.Header.Set("Authorization", accessToken)
	req.Header.Set("Procore-Company-Id", companyID)

	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Forward the response
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}
