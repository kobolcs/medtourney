*** Settings ***
Documentation     Scrape chess tournaments from chess-results.com
Library           Browser
Library           OperatingSystem
Library           DateTime
Library           ./TournamentProcessor.py

*** Variables ***
${SEARCH_URL}     https://s1.chess-results.com/TurnierSuche.aspx?lan=1
${DOWNLOAD_DIR}   ${CURDIR}/downloads
${MAX_RESULTS}    5000
${DATE_RANGE_MONTHS}    6

*** Test Cases ***
Scrape European Chess Tournaments
    [Documentation]    Download tournament data from chess-results.com and process it
    [Tags]    scraping

    Setup Browser And Download Directory
    Navigate To Search Page
    Fill Search Form
    Download Tournament Data
    ${tournaments}=    Process Downloaded Excel
    Export Tournaments To JSON    ${tournaments}
    Export Tournament Metadata
    [Teardown]    Close Browser

*** Keywords ***
Setup Browser And Download Directory
    [Documentation]    Initialize browser with download directory
    Create Directory    ${DOWNLOAD_DIR}
    New Browser    chromium    headless=True
    New Context    acceptDownloads=True
    ...            viewport={'width': 1920, 'height': 1080}
    New Page    ${SEARCH_URL}

Navigate To Search Page
    [Documentation]    Navigate to the tournament search page
    Go To    ${SEARCH_URL}
    Wait For Load State    domcontentloaded    timeout=30s
    Log    Navigated to search page

Fill Search Form
    [Documentation]    Fill in the search form with date range and filters

    # Get current date and calculate end date based on configuration
    ${start_date}=    Get Current Date    result_format=%d.%m.%Y
    ${days}=    Evaluate    ${DATE_RANGE_MONTHS} * 30
    ${end_date}=    Add Time To Date    ${start_date}    ${days} days    result_format=%d.%m.%Y    date_format=%d.%m.%Y

    Log    Searching from ${start_date} to ${end_date} (${DATE_RANGE_MONTHS} months)

    # Try to fill date fields (names may vary on the actual page)
    # We'll try multiple possible selectors
    ${date_from_filled}=    Run Keyword And Return Status
    ...    Fill Text    input[name*="DateFrom"], input[id*="DateFrom"], input[type="text"]    ${start_date}

    ${date_to_filled}=    Run Keyword And Return Status
    ...    Fill Text    input[name*="DateTo"], input[id*="DateTo"], input[type="text"] >> nth=1    ${end_date}

    Log    Date fields filled: from=${date_from_filled}, to=${date_to_filled}

    # Select result limit (2000 results)
    ${limit_set}=    Run Keyword And Return Status
    ...    Select Options By    select[name*="PageSize"], select[id*="PageSize"]    value    ${MAX_RESULTS}

    IF    not ${limit_set}
        Log    Could not set result limit, using default
    END

Download Tournament Data
    [Documentation]    Click download button and wait for Excel file

    # Look for Excel download button (usually has "Excel" or "XLS" in text)
    ${download_button}=    Get Element    button:has-text("Excel"), a:has-text("Excel"), input[value*="Excel"]

    # Click and wait for download
    ${download_promise}=    Promise To Wait For Download    saveAs=${DOWNLOAD_DIR}/TournamentSearch.xlsx
    Click    ${download_button}
    ${file_info}=    Wait For    ${download_promise}

    Log    Downloaded file info: ${file_info}

    # Extract the actual file path from the download result
    ${downloaded_path}=    Set Variable    ${file_info}[saveAs]
    Log    File saved to: ${downloaded_path}

    Set Suite Variable    ${DOWNLOADED_FILE}    ${downloaded_path}

Process Downloaded Excel
    [Documentation]    Process the downloaded Excel file with custom Python keyword
    ${tournaments}=    Load And Filter Tournaments    ${DOWNLOADED_FILE}
    ${count}=    Get Length    ${tournaments}
    Log    Processed ${count} tournaments
    RETURN    ${tournaments}

Export Tournaments To JSON
    [Documentation]    Export processed tournaments to JSON
    [Arguments]    ${tournaments}
    Export To JSON    ${tournaments}    ${CURDIR}/tournaments_data.json
    Log    Exported tournaments to tournaments_data.json

Export Tournament Metadata
    [Documentation]    Write a metadata sidecar (provenance + filtering stats)
    Export Metadata    ${CURDIR}/tournaments_data_meta.json
    Log    Exported scrape metadata to tournaments_data_meta.json
