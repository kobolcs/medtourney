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
# Generous default timeout for slow Excel generation on chess-results.com
${BROWSER_TIMEOUT}    90s
# How many times to attempt the Excel download before giving up
${DOWNLOAD_RETRIES}    3

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
    # chess-results.com can be slow to generate large Excel exports, so raise
    # the default timeout well above the 10s default to avoid flaky downloads.
    Set Browser Timeout    ${BROWSER_TIMEOUT}

Navigate To Search Page
    [Documentation]    Navigate to the tournament search page
    Go To    ${SEARCH_URL}
    Wait For Load State    domcontentloaded    timeout=30s
    Log    Navigated to search page

Fill Search Form
    [Documentation]    Fill in the search form with date range and filters

    # Calculate date range in ISO format (YYYY-MM-DD) required by input[type="date"]
    ${start_iso}=    Get Current Date    result_format=%Y-%m-%d
    ${days}=    Evaluate    ${DATE_RANGE_MONTHS} * 30
    ${end_iso}=    Add Time To Date    ${start_iso}    ${days} days    result_format=%Y-%m-%d    date_format=%Y-%m-%d

    Log    Searching tournaments ending between ${start_iso} and ${end_iso} (${DATE_RANGE_MONTHS} months)

    # The page has two input[type="date"] fields for "tournament end between".
    # Use a short timeout in case the page layout changes; RKARS handles failures.
    Set Browser Timeout    10s
    ${date_from_filled}=    Run Keyword And Return Status
    ...    Fill Text    input[type="date"] >> nth=0    ${start_iso}

    ${date_to_filled}=    Run Keyword And Return Status
    ...    Fill Text    input[type="date"] >> nth=1    ${end_iso}
    Set Browser Timeout    ${BROWSER_TIMEOUT}

    Log    Date fields filled: from=${date_from_filled}, to=${date_to_filled}

    # "Maximum number of lines" is the last <select> on the page (5th dropdown).
    # Default is 100 – set to ${MAX_RESULTS} to get a full European dataset.
    Set Browser Timeout    5s
    ${limit_set}=    Run Keyword And Return Status
    ...    Select Options By    select >> nth=4    value    ${MAX_RESULTS}
    Set Browser Timeout    ${BROWSER_TIMEOUT}

    IF    not ${limit_set}
        Log    Could not set result limit, using default
    END

Download Tournament Data
    [Documentation]    Click download button and wait for Excel file, retrying on
    ...    transient timeouts since chess-results.com can be slow under load.

    FOR    ${attempt}    IN RANGE    1    ${DOWNLOAD_RETRIES} + 1
        ${status}=    Run Keyword And Return Status    Attempt Excel Download
        IF    ${status}
            Log    Download succeeded on attempt ${attempt}
            RETURN
        END
        Log    Download attempt ${attempt} failed, retrying...    level=WARN
        # A reload resets the search form, so re-navigate and re-fill it.
        Navigate To Search Page
        Fill Search Form
    END
    Fail    Excel download failed after ${DOWNLOAD_RETRIES} attempts

Attempt Excel Download
    [Documentation]    Single attempt to click the Excel button and save the file

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
