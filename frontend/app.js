document.addEventListener('DOMContentLoaded', function() {
    const API_BASE_URL = 'http://localhost:8080';
    let accessToken = localStorage.getItem('procoreAccessToken') || '';
    let currentFilters = {};

    // DOM elements
    const searchFilter = document.getElementById('searchFilter');
    const getAuthBtn = document.getElementById('getAuthBtn');
    const getTokenBtn = document.getElementById('getTokenBtn');
    const authCodeInput = document.getElementById('authCode');
    const tokenStatus = document.getElementById('tokenStatus');
    const refreshLogsBtn = document.getElementById('refreshLogsBtn');
    const logsList = document.getElementById('logsList');
    const fromDateInput = document.getElementById('fromDate');
    const toDateInput = document.getElementById('toDate');
    const severityFilter = document.getElementById('severityFilter');
    const companyFilter = document.getElementById('companyFilter');
    const filterLogsBtn = document.getElementById('filterLogsBtn');
    const filterSearchBtn = document.getElementById('filterSearchBtn');

    const clearFilterBtn = document.getElementById('clearFilterBtn');

    // Set default date values to current month
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    fromDateInput.valueAsDate = firstDayOfMonth;
    toDateInput.valueAsDate = today;

    // Update token status display
    function updateTokenStatus() {
        function updateTokenStatus() {
            const tokenAvailable = accessToken && accessToken.length > 0;
            tokenStatus.textContent = tokenAvailable ? '✔ Token available' : '✖ No token';
            tokenStatus.className = tokenAvailable ? 'token-status token-valid' : 'token-status token-invalid';
        }
    }

    // Initialize
    updateTokenStatus();

    // Event listeners
    getAuthBtn.addEventListener('click', getAuthorizationCode);
    getTokenBtn.addEventListener('click', getAccessToken);
    refreshLogsBtn.addEventListener('click', () => fetchAccidentLogs(currentFilters));
    filterLogsBtn.addEventListener('click', applyDateFilter);
    filterSearchBtn.addEventListener('click', applySearchFilter);
    clearFilterBtn.addEventListener('click', clearDateFilter);

    // Get authorization code
    function getAuthorizationCode() {
        const clientId = '_DKvGlwYKsqe9QxBhZ00eZ9RmmOKd8dzyovUKxVL510';
        const authUrl = `https://login-sandbox.procore.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob`;
        window.open(authUrl, '_blank');
    }

    // Get access token
    function getAccessToken() {
        const code = authCodeInput.value.trim();
        if (!code) {
            showError('Please enter the authorization code');
            return;
        }

        setLoading(getTokenBtn, true);

        fetch(`${API_BASE_URL}/api/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to get access token');
                });
            }
            return response.json();
        })
        .then(data => {
            accessToken = data.access_token;
            localStorage.setItem('procoreAccessToken', accessToken);
            updateTokenStatus();
            showSuccess('Access token obtained successfully');
            fetchAccidentLogs();
        })
        .catch(error => {
            handleError(error);
        })
        .finally(() => {
            setLoading(getTokenBtn, false);
        });
    }

    // Fetch accident logs
    function fetchAccidentLogs(filters = {}) {
        
        if (!accessToken) {
            showError('Please authenticate first');
            return Promise.reject('No access token');
        }

        setLoading(refreshLogsBtn, true);
        
        // In the fetchAccidentLogs function:
        const params = new URLSearchParams();
        if (filters.fromDate) params.append('start_date', filters.fromDate);
        if (filters.toDate) params.append('end_date', filters.toDate);
        if (filters.severity) params.append('severity', filters.severity);
        if (filters.company) params.append('company', filters.company);
        
        const url = params.toString() 
            ? `${API_BASE_URL}/api/accident-logs/filter?${params.toString()}`
            : `${API_BASE_URL}/api/accident-logs`;

        return fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to fetch logs');
                });
            }
            return response.json();
        })
        .then(logs => {
            if (!Array.isArray(logs)) {
                throw new Error('Invalid response format');
            }
            renderLogsList(logs);
            return logs;
        })
        .catch(error => {
            handleError(error);
            throw error;
        })
        .finally(() => {
            setLoading(refreshLogsBtn, false);
        });
    }

    // Render logs list
    function renderLogsList(logs) {
        if (!logs || logs.length === 0) {
            logsList.innerHTML = '<div class="no-logs">No logs found for the selected filters</div>';
            return;
        }

        logsList.innerHTML = logs.map(log => `
            <div class="log-item" data-id="${log.id}">
                <div class="log-header">
                    <h3>${log.involved_name || 'Unknown'} (${log.involved_company || 'Unknown'})</h3>
                    <span class="severity-${log.severity || 'unknown'}">${(log.severity || 'unknown').toUpperCase()}</span>
                </div>
                <div class="log-details">
                    <div>
                        <strong>Date:</strong>
                        <span>${log.date || 'N/A'}</span>
                    </div>
                    <div>
                        <strong>Time:</strong>
                        <span>${formatTime(log.time_hour, log.time_minute)}</span>
                    </div>
                    <div>
                        <strong>Location:</strong>
                        <span>${log.location || 'N/A'}</span>
                    </div>
                </div>
                ${log.comments ? `<div class="log-comments"><strong>Comments:</strong> ${log.comments}</div>` : ''}
            </div>
        `).join('');
    }

    // // Add debounce to search input
    // let daterangeTimeout;
    // searchFilter.addEventListener('input', () => {
    //     clearTimeout(daterangeTimeout);
    //     daterangeTimeout = setTimeout(() => {
    //         applySearchFilter();
    //     }, 500);
    // });

    // let searchTimeout;
    // searchFilter.addEventListener('input', () => {
    //     clearTimeout(searchTimeout);
    //     searchTimeout = setTimeout(() => {
    //         applySearchFilter();
    //     }, 500);
    // });

    function applySearchFilter() {
        const searchTerm = searchFilter.value.trim();
    
        // Check if the search term is a numeric ID
        if (!isNaN(searchTerm) && searchTerm !== '') {
            const logId = parseInt(searchTerm, 10);
            if (!isNaN(logId)) {
                fetchAccidentLogById(logId);
                return;
            }
        }
    
        // Proceed with normal search if not an ID
        currentFilters = { ...(searchTerm && { search: searchTerm }) };
        fetchAccidentLogs(currentFilters)
            .catch(error => {
                console.error('Filter error:', error);
                showError('Failed to apply filters. Please try again.');
            });
    }
    
    function fetchAccidentLogById(id) {
        if (!accessToken) {
            showError('Please authenticate first');
            return;
        }
    
        setLoading(filterSearchBtn, true);
    
        fetch(`${API_BASE_URL}/api/accident-logs/${id}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Log not found');
                });
            }
            return response.json();
        })
        .then(log => {
            if (log && Object.keys(log).length > 0) {
                renderLogsList([log]); // Wrap log in array for consistent rendering
            } else {
                logsList.innerHTML = '<div class="no-logs">Log not found</div>';
            }
        })
        .catch(error => {
            showError(error.message);
            logsList.innerHTML = '<div class="no-logs">Log not found</div>';
        })
        .finally(() => {
            setLoading(filterSearchBtn, false);
        });
    }
    // Apply date filter
    function applyDateFilter() {
        const fromDate = fromDateInput.value;
        const toDate = toDateInput.value;
        const severity = severityFilter.value;
        const company = companyFilter.value.trim();

        // Validate dates
        if (fromDate && toDate) {
            const fromDateObj = new Date(fromDate);
            const toDateObj = new Date(toDate);
            
            if (fromDateObj > toDateObj) {
                showError('"From" date cannot be after "To" date');
                return;
            }
        }

        setLoading(filterLogsBtn, true);

        currentFilters = {
            ...(fromDate && { fromDate }),
            ...(toDate && { toDate }),
            ...(severity && { severity }),
            ...(company && { company }),
        };

        fetchAccidentLogs(currentFilters)
            .catch(error => {
                console.error('Filter error:', error);
                showError('Failed to apply filters. Please try again.');
            })
            .finally(() => {
                setLoading(filterLogsBtn, false);
            });
    }

    // Clear date filter
    function clearDateFilter() {
        fromDateInput.valueAsDate = firstDayOfMonth;
        toDateInput.valueAsDate = today;
        severityFilter.value = '';
        companyFilter.value = '';
        currentFilters = {};
        fetchAccidentLogs();
    }

    // Formats time into "HH:MM" format
    function formatTime(hour, minute) {
        const hh = String(hour || 0).padStart(2, '0');
        const mm = String(minute || 0).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    // Loading state toggle for buttons
    function setLoading(button, isLoading) {
        button.disabled = isLoading;
        const originalText = button.dataset.originalText || button.textContent;
        if (isLoading) {
            button.dataset.originalText = originalText;
            button.textContent = 'Loading...';
        } else {
            button.textContent = originalText;
        }
    }

    // Show error message
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Show success message
    function showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        tokenStatus.textContent =  '✔ Token available';
        tokenStatus.className = 'token-status token-valid';
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    // Initial fetch of logs if token exists
    if (accessToken) {
        fetchAccidentLogs();
    }
});