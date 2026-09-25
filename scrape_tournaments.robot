*** Settings ***
Documentation     Scrape chess tournaments from chess-results.com for all ECU federations
Library           Browser
Library           OperatingSystem
Library           DateTime
Library           ./TournamentProcessor.py

*** Variables ***
${SEARCH_URL}     https://s1.chess-results.com/TurnierSuche.aspx?lan=1
${DOWNLOAD_DIR}   ${CURDIR}/downloads
${MAX_RESULTS}    5
# Note: value=5 selects the "2000" option in the results-per-page dropdown.
# chess-results.com allows 100/250/500/1000/1500/2000 (values 0-5).
${DATE_RANGE_MONTHS}    6
# Generous default timeout for slow Excel generation on chess-results.com
${BROWSER_TIMEOUT}    90s
# How many times to attempt the Excel download before giving up
${DOWNLOAD_RETRIES}    3
# Official ECU (European Chess Union) 54-member federation FIDE codes
@{ECU_FEDS}
...    ALB    AND    ARM    AUT    AZE    BEL    BIH    BUL    CRO    CYP
...    CZE    DEN    ENG    EST    FAI    FIN    FRA    GEO    GER    GCI
...    GIB    GRE    HUN    IRL    ISL    IOM    ITA    JCI    KOS    LAT
...    LIE    LTU    LUX    MLT    MDA    MNC    MNE    NED    MKD    NOR
...    POL    POR    ROU    SMR    SCO    SRB    SVK    SLO    ESP    SWE
...    SUI    TUR    UKR    WLS

*** Test Cases ***
Scrape European Chess Tournaments
    [Documentation]    Download per-federation tournament data from all 54 ECU
    ...    federations, deduplicate by URL, and export the merged result to JSON.
    [Tags]    scraping

    Setup Browser And Download Directory
    Initialize Accumulator
    FOR    ${fed}    IN    @{ECU_FEDS}
        ${ok}=    Run Keyword And Return Status    Scrape Federation    ${fed}
        IF    not ${ok}
            Log    Federation ${fed} failed or has no dropdown option, skipping    level=WARN
        END
        Sleep    2s
    END
    ${tournaments}=    Finalize Accumulated
    ${count}=    Get Length    ${tournaments}
    Log    Total unique tournaments across all ECU federations: ${count}
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
    # chess-results.com can be slow to generate large Excel exports
    Set Browser Timeout    ${BROWSER_TIMEOUT}

Navigate To Search Page
    [Documentation]    Navigate to the tournament search page
    Go To    ${SEARCH_URL}
    Wait For Load State    domcontentloaded    timeout=30s
    Log    Navigated to search page

Scrape Federation
    [Documentation]    Scrape one ECU federation and accumulate results.
    ...    Download failures (no results, transient network) are logged and skipped
    ...    rather than propagated, so a single empty/slow federation cannot abort the run.
    [Arguments]    ${fed}
    Log    Scraping federation: ${fed}
    Navigate To Search Page
    ${fed_applied}=    Fill Search Form    ${fed}
    IF    not ${fed_applied}
        Log    Federation ${fed}: dropdown option not found, skipping    level=WARN
        RETURN
    END
    ${downloaded}=    Run Keyword And Return Status    Download Tournament Data For Fed    ${fed}
    IF    not ${downloaded}
        Log    Federation ${fed}: Excel download failed after ${DOWNLOAD_RETRIES} attempts (0 results or site error)    level=WARN
        RETURN
    END
    ${new_count}=    Accumulate Fed Tournaments    ${DOWNLOAD_DIR}/TournamentSearch.xlsx
    Log    Federation ${fed}: ${new_count} new unique tournaments added

Fill Search Form    # robocop: off=too-long-keyword  known, see CLAUDE.md
    [Documentation]    Fill the search form. If a federation is given it is selected first
    ...    because chess-results.com fires an ASP.NET postback that reloads the page —
    ...    dates and max-results must be filled on the post-reload page.
    ...    Returns True if the federation option was found (or no fed given).
    [Arguments]    ${fed}=${EMPTY}

    # Step 1: select federation — triggers a full-page postback on chess-results.com
    ${fed_applied}=    Set Variable    ${TRUE}
    IF    '${fed}' != '${EMPTY}'
        Set Browser Timeout    15s
        ${fed_applied}=    Run Keyword And Return Status    Select Options By    \#P1_combo_land    value    ${fed}
        IF    ${fed_applied}
            # Wait for the postback navigation to complete before touching other fields
            Wait For Load State    domcontentloaded    timeout=15s
        END
        Set Browser Timeout    ${BROWSER_TIMEOUT}
        IF    not ${fed_applied}
            Log    Federation ${fed}: no option with value="${fed}" in #P1_combo_land dropdown — skipping    level=WARN
            RETURN    ${fed_applied}
        END
    END

    # Step 2: fill dates (must come AFTER postback — postback resets date fields)
    ${start_iso}=    Get Current Date    result_format=%Y-%m-%d
    ${days}=    Evaluate    ${DATE_RANGE_MONTHS} * 30
    ${end_iso}=    Add Time To Date    ${start_iso}    ${days} days    result_format=%Y-%m-%d    date_format=%Y-%m-%d
    Log    Date range: ${start_iso} to ${end_iso} (${DATE_RANGE_MONTHS} months), fed=${fed}
    Set Browser Timeout    10s
    Run Keyword And Return Status    Fill Text    input[type="date"] >> nth=0    ${start_iso}
    Run Keyword And Return Status    Fill Text    input[type="date"] >> nth=1    ${end_iso}
    Set Browser Timeout    ${BROWSER_TIMEOUT}

    # Step 3: set max results to 2000 (value 5 in \#P1_combo_anzahl_zeilen)
    Set Browser Timeout    5s
    ${limit_set}=    Run Keyword And Return Status    Select Options By    \#P1_combo_anzahl_zeilen    value    ${MAX_RESULTS}
    Set Browser Timeout    ${BROWSER_TIMEOUT}
    IF    not ${limit_set}
        Log    Could not set result limit, using default    level=WARN
    END

    RETURN    ${fed_applied}

Download Tournament Data For Fed
    [Documentation]    Click the Excel button and wait for download, retrying on
    ...    transient failures. Re-fills the form with the same federation on retry.
    ...    Returns without error when no Excel button is present (0 results for fed).
    [Arguments]    ${fed}=${EMPTY}

    FOR    ${attempt}    IN RANGE    1    ${DOWNLOAD_RETRIES} + 1
        ${status}=    Run Keyword And Return Status    Attempt Excel Download
        IF    ${status}
            Log    Download succeeded on attempt ${attempt}
            RETURN
        END
        Log    Download attempt ${attempt} failed, retrying...    level=WARN
        Navigate To Search Page
        Fill Search Form    ${fed}
    END
    Fail    Excel download failed after ${DOWNLOAD_RETRIES} attempts

Dismiss Cookie Consent
    [Documentation]    Dismiss the Cookiebot consent overlay if it is present.
    ...    The overlay intercepts pointer events and prevents the Excel button from
    ...    being clicked.
    Set Browser Timeout    10s
    ${cookie_btn}=    Set Variable    \#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll
    ${accepted}=    Run Keyword And Return Status    Click    ${cookie_btn}
    IF    not ${accepted}
        ${remove_js}=    Set Variable    document.querySelectorAll('[id^="CybotCookiebot"]').forEach(function(el){el.remove()})
        Run Keyword And Return Status    Evaluate JavaScript    ${NONE}    ${remove_js}
    END
    Set Browser Timeout    ${BROWSER_TIMEOUT}

Attempt Excel Download
    [Documentation]    Single attempt to click the Excel button and save the file

    Dismiss Cookie Consent

    ${download_button}=    Get Element    button:has-text("Excel"), a:has-text("Excel"), input[value*="Excel"]

    # Set 30s timeout BEFORE creating the promise — the promise inherits it
    Set Browser Timeout    30s
    ${download_promise}=    Promise To Wait For Download    saveAs=${DOWNLOAD_DIR}/TournamentSearch.xlsx
    Click    ${download_button}
    ${file_info}=    Wait For    ${download_promise}
    Set Browser Timeout    ${BROWSER_TIMEOUT}

    Log    Downloaded: ${file_info}[saveAs]
    Set Suite Variable    ${DOWNLOADED_FILE}    ${file_info}[saveAs]

Export Tournaments To JSON
    [Documentation]    Export processed tournaments to JSON
    [Arguments]    ${tournaments}
    Export To JSON    ${tournaments}    ${CURDIR}/tournaments_data.json
    Log    Exported tournaments to tournaments_data.json

Export Tournament Metadata
    [Documentation]    Write a metadata sidecar (provenance + filtering stats)
    Export Metadata    ${CURDIR}/tournaments_data_meta.json
    Log    Exported scrape metadata to tournaments_data_meta.json
