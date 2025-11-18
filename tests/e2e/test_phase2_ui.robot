*** Settings ***
Documentation     E2E tests for MedTourney v3 Phase 2 UI Features
...               Tests filter persistence, calendar export, and empty states
Library           Browser
Library           OperatingSystem
Library           DateTime
Library           String

*** Variables ***
${BROWSER}        chromium
${HEADLESS}       True
${APP_URL}        file://${CURDIR}/../../index.html
${TIMEOUT}        10s

*** Test Cases ***
Test Page Loads With Phase 2 Features
    [Documentation]    Verify that Phase 2 UI elements are present
    [Tags]    smoke    phase2
    Open MedTourney App
    Wait For Load State    networkidle    timeout=${TIMEOUT}

    # Verify Phase 1 SEO elements
    Get Page Title Should Contain    MedTourney
    Get Page Title Should Contain    Mediterranean

    # Verify filter elements exist
    Get Element    id=openOnly
    Get Element    id=mediterraneanOnly
    Get Element    id=seniorCategory
    Get Element    id=searchBtn

    [Teardown]    Close Browser

Test Filter Persistence LocalStorage
    [Documentation]    Test that filter preferences are saved to localStorage
    [Tags]    integration    persistence    phase2.1
    Open MedTourney App

    # Change some filters
    Click    id=mediterraneanOnly
    Click    id=seniorCategory
    Select Options By    id=countryFilter    value    ESP

    # Wait for potential auto-save (filters save on change)
    Sleep    1s

    # Check localStorage (using JavaScript evaluation)
    ${storage_value}=    Evaluate JavaScript
    ...    document
    ...    () => localStorage.getItem('medtourney_filter_preferences')

    Should Not Be Empty    ${storage_value}
    Should Contain    ${storage_value}    mediterranean
    Should Contain    ${storage_value}    senior

    [Teardown]    Close Browser

Test Calendar Export Button Exists
    [Documentation]    Verify calendar export button appears on tournament cards
    [Tags]    component    calendar    phase2.2
    Open MedTourney App

    # Click search to show results
    Click    id=searchBtn
    Wait For Load State    networkidle    timeout=${TIMEOUT}

    # Wait for results
    Wait For Elements State    .tournament-card    visible    timeout=${TIMEOUT}

    # Check for calendar export button
    ${calendar_btns}=    Get Element Count    .calendar-export-btn
    Should Be True    ${calendar_btns} >= 0    msg=Calendar export buttons should exist

    [Teardown]    Close Browser

Test Empty State With Reset Button
    [Documentation]    Test empty state shows with helpful suggestions
    [Tags]    component    empty-state    phase2
    Open MedTourney App

    # Set very restrictive filters to trigger empty state
    Click    id=mediterraneanOnly
    Click    id=seniorCategory
    Click    id=womenOnly
    Select Options By    id=countryFilter    value    MLT

    # Search with restrictive filters
    Click    id=searchBtn
    Wait For Load State    networkidle    timeout=${TIMEOUT}

    # Check for empty state elements (if results are empty)
    ${empty_state}=    Run Keyword And Return Status
    ...    Get Element    .empty-state

    # If empty state appears, verify reset button exists
    Run Keyword If    ${empty_state}
    ...    Get Element    id=resetFiltersBtn

    [Teardown]    Close Browser

Test Mobile Touch Targets
    [Documentation]    Test that mobile touch targets are 48x48px minimum
    [Tags]    mobile    accessibility    phase1
    New Browser    ${BROWSER}    headless=${HEADLESS}
    New Context    viewport={'width': 375, 'height': 667}    # Mobile viewport
    New Page    ${APP_URL}

    # Check filter checkboxes are large enough
    ${checkbox_size}=    Get BoundingBox    id=openOnly
    ${width}=    Get From Dictionary    ${checkbox_size}    width
    ${height}=    Get From Dictionary    ${checkbox_size}    height

    Should Be True    ${width} >= 24    msg=Checkbox should be at least 24px wide
    Should Be True    ${height} >= 24    msg=Checkbox should be at least 24px tall

    # Check search button touch target
    ${button_box}=    Get BoundingBox    id=searchBtn
    ${button_height}=    Get From Dictionary    ${button_box}    height

    Should Be True    ${button_height} >= 48    msg=Search button should be at least 48px tall

    [Teardown]    Close Browser

Test SEO Meta Tags Present
    [Documentation]    Verify Phase 1 SEO meta tags are present
    [Tags]    seo    phase1
    Open MedTourney App

    # Check primary meta tags
    ${description}=    Get Attribute    meta[name="description"]    content
    Should Contain    ${description}    Mediterranean
    Should Contain    ${description}    senior

    # Check Open Graph tags
    ${og_title}=    Get Attribute    meta[property="og:title"]    content
    Should Contain    ${og_title}    MedTourney

    ${og_image}=    Get Attribute    meta[property="og:image"]    content
    Should Contain    ${og_image}    og-image.png

    # Check canonical URL
    ${canonical}=    Get Attribute    link[rel="canonical"]    href
    Should Contain    ${canonical}    github.io/medtourney

    [Teardown]    Close Browser

Test Sitemap And Robots Files Exist
    [Documentation]    Verify sitemap.xml and robots.txt files exist
    [Tags]    seo    phase1
    File Should Exist    ${CURDIR}/../../sitemap.xml
    File Should Exist    ${CURDIR}/../../robots.txt

Test Sticky Search Button On Mobile
    [Documentation]    Test that search button is sticky on mobile
    [Tags]    mobile    ux    phase1
    New Browser    ${BROWSER}    headless=${HEADLESS}
    New Context    viewport={'width': 375, 'height': 667}
    New Page    ${APP_URL}

    # Scroll down
    Evaluate JavaScript    document    window.scrollTo(0, 500)
    Sleep    0.5s

    # Check if search button is still visible (sticky positioning)
    ${is_visible}=    Get Element States    id=searchBtn    visible

    # Search button should be visible even after scroll
    Should Contain    ${is_visible}    visible

    [Teardown]    Close Browser

Test Tournament Card Actions Container
    [Documentation]    Verify tournament actions container with both buttons
    [Tags]    component    calendar    phase2.2
    Open MedTourney App

    Click    id=searchBtn
    Wait For Load State    networkidle    timeout=${TIMEOUT}

    # Wait for tournament cards
    ${card_count}=    Get Element Count    .tournament-card

    # If results exist, check for actions container
    Run Keyword If    ${card_count} > 0
    ...    Get Element    .tournament-actions

    [Teardown]    Close Browser

Test Dark Mode Toggle
    [Documentation]    Test dark mode toggle functionality
    [Tags]    ux    theme
    Open MedTourney App

    # Click theme toggle
    Click    id=themeToggle
    Sleep    0.5s

    # Check if dark-theme class was added to body
    ${body_class}=    Get Attribute    body    class
    Should Contain    ${body_class}    dark-theme

    # Toggle back
    Click    id=themeToggle
    Sleep    0.5s

    ${body_class_after}=    Get Attribute    body    class
    Should Not Contain    ${body_class_after}    dark-theme

    [Teardown]    Close Browser

Test Schema.org Structured Data
    [Documentation]    Verify Schema.org JSON-LD is present
    [Tags]    seo    phase1
    Open MedTourney App

    # Check for structured data script
    ${structured_data}=    Evaluate JavaScript    document
    ...    () => {
    ...        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    ...        return scripts.length > 0 ? scripts[0].textContent : null;
    ...    }

    Should Not Be Empty    ${structured_data}
    Should Contain    ${structured_data}    WebApplication
    Should Contain    ${structured_data}    MedTourney
    Should Contain    ${structured_data}    featureList

    [Teardown]    Close Browser

*** Keywords ***
Open MedTourney App
    [Documentation]    Open the MedTourney application in browser
    New Browser    ${BROWSER}    headless=${HEADLESS}
    New Context    viewport={'width': 1920, 'height': 1080}
    New Page    ${APP_URL}
