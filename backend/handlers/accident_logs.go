package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

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

type AuthTokenRequest struct {
	Code string `json:"code"`
}

type AuthTokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
}

func GetAuthToken(c *gin.Context) {
	var req AuthTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Authorization code is required"})
		return
	}

	// Prepare request to Procore's token endpoint
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("client_id", os.Getenv("PROCORE_CLIENT_ID"))
	data.Set("client_secret", os.Getenv("PROCORE_CLIENT_SECRET"))
	data.Set("code", req.Code)
	data.Set("redirect_uri", "urn:ietf:wg:oauth:2.0:oob")

	reqURL := "https://login-sandbox.procore.com/oauth/token"
	client := &http.Client{Timeout: 10 * time.Second}

	request, err := http.NewRequest("POST", reqURL, bytes.NewBufferString(data.Encode()))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token request"})
		return
	}

	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	response, err := client.Do(request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get token from Procore"})
		return
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read token response"})
		return
	}

	if response.StatusCode != http.StatusOK {
		c.JSON(response.StatusCode, gin.H{"error": string(body)})
		return
	}

	var tokenResp AuthTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse token response"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": tokenResp.AccessToken,
		"token_type":   tokenResp.TokenType,
		"expires_in":   tokenResp.ExpiresIn,
	})
}

func GetAccidentLogs(c *gin.Context) {
	accessToken := c.GetHeader("Authorization")
	if accessToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
		return
	}
	fmt.Println("HELLO")
	projectID := os.Getenv("PROCORE_PROJECT_ID")
	companyID := os.Getenv("PROCORE_COMPANY_ID")

	apiUrl := "https://sandbox.procore.com/rest/v1.0/projects/" + projectID + "/accident_logs"

	req, err := http.NewRequest("GET", apiUrl, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	req.Header.Set("Authorization", accessToken)
	req.Header.Set("Procore-Company-Id", companyID)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}

func GetFilteredAccidentLogs(c *gin.Context) {
	accessToken := c.GetHeader("Authorization")
	if accessToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
		return
	}

	fromDate := c.Query("from_date")
	toDate := c.Query("to_date")

	if fromDate == "" && toDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one date parameter is required"})
		return
	}

	projectID := os.Getenv("PROCORE_PROJECT_ID")
	companyID := os.Getenv("PROCORE_COMPANY_ID")

	apiUrl := "https://sandbox.procore.com/rest/v1.0/projects/" + projectID + "/accident_logs"

	params := url.Values{}
	if fromDate != "" {
		params.Add("filters[date][gte]", fromDate)
	}
	if toDate != "" {
		params.Add("filters[date][lte]", toDate)
	}

	if len(params) > 0 {
		apiUrl += "?" + params.Encode()
	}

	req, err := http.NewRequest("GET", apiUrl, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	req.Header.Set("Authorization", accessToken)
	req.Header.Set("Procore-Company-Id", companyID)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}

func CreateAccidentLog(c *gin.Context) {
	accessToken := c.GetHeader("Authorization")
	if accessToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
		return
	}

	var logData AccidentLog
	if err := c.ShouldBindJSON(&logData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	projectID := os.Getenv("PROCORE_PROJECT_ID")
	companyID := os.Getenv("PROCORE_COMPANY_ID")

	formData := url.Values{}
	formData.Set("accident_log[comments]", logData.Comments)
	formData.Set("accident_log[date]", logData.Date)
	formData.Set("accident_log[datetime]", logData.Datetime)
	formData.Set("accident_log[involved_company]", logData.InvolvedCompany)
	formData.Set("accident_log[involved_name]", logData.InvolvedName)
	formData.Set("accident_log[time_hour]", strconv.Itoa(logData.TimeHour))
	formData.Set("accident_log[time_minute]", strconv.Itoa(logData.TimeMinute))

	req, err := http.NewRequest("POST", "https://sandbox.procore.com/rest/v1.0/projects/"+projectID+"/accident_logs", bytes.NewBufferString(formData.Encode()))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	req.Header.Set("Authorization", accessToken)
	req.Header.Set("Procore-Company-Id", companyID)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}

func DeleteAccidentLog(c *gin.Context) {
	accessToken := c.GetHeader("Authorization")
	if accessToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
		return
	}

	logID := c.Param("id")
	if logID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Log ID is required"})
		return
	}

	projectID := os.Getenv("PROCORE_PROJECT_ID")
	companyID := os.Getenv("PROCORE_COMPANY_ID")

	req, err := http.NewRequest("DELETE", "https://sandbox.procore.com/rest/v1.0/projects/"+projectID+"/accident_logs/"+logID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	req.Header.Set("Authorization", accessToken)
	req.Header.Set("Procore-Company-Id", companyID)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}
