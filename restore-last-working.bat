@echo off
setlocal EnableDelayedExpansion

title OUTheBuilderWBA - Restore Last Working Version

echo.
echo ============================================================
echo        OUTheBuilderWBA - PROJECT RESTORE TOOL
echo ============================================================
echo.

REM ------------------------------------------------------------
REM 1. Check that this is a Git repository
REM ------------------------------------------------------------
if not exist ".git" (
    echo ERROR: This folder is not a Git repository.
    echo.
    echo Put this script inside the OUTheBuilderWBA project folder.
    pause
    exit /b 1
)

REM ------------------------------------------------------------
REM 2. Show current status
REM ------------------------------------------------------------
echo [1/6] Checking current project...
echo.

git status

echo.
echo ============================================================
echo.

REM ------------------------------------------------------------
REM 3. Create a backup branch before changing anything
REM ------------------------------------------------------------
echo [2/6] Creating a backup of the CURRENT project...
echo.

for /f "tokens=*" %%A in ('git rev-parse --short HEAD') do set CURRENT_COMMIT=%%A

for /f "tokens=1-3 delims=/ " %%A in ("%date%") do (
    set DATESTAMP=%%A-%%B-%%C
)

for /f "tokens=1-2 delims=: " %%A in ("%time%") do (
    set TIMESTAMP=%%A%%B
)

set BACKUP_BRANCH=backup-before-restore-%CURRENT_COMMIT%-%RANDOM%

git branch "%BACKUP_BRANCH%"

if errorlevel 1 (
    echo.
    echo ERROR: Could not create backup branch.
    pause
    exit /b 1
)

echo.
echo Backup branch created:
echo     %BACKUP_BRANCH%
echo.

REM ------------------------------------------------------------
REM 4. Save uncommitted changes in a stash
REM ------------------------------------------------------------
echo [3/6] Checking for uncommitted changes...
echo.

git diff --quiet
set DIFF_RESULT=%errorlevel%

git diff --cached --quiet
set CACHED_RESULT=%errorlevel%

if %DIFF_RESULT% EQU 1 (
    echo Uncommitted changes detected.
    echo Saving them in a Git stash...
    git stash push -u -m "Automatic backup before restore %CURRENT_COMMIT%"
    
    if errorlevel 1 (
        echo.
        echo ERROR: Could not stash current changes.
        echo Your backup branch still exists:
        echo     %BACKUP_BRANCH%
        pause
        exit /b 1
    )

    echo Current uncommitted work has been safely stashed.
) else (
    echo No unstaged changes detected.
)

echo.

REM ------------------------------------------------------------
REM 5. Determine restore commit
REM ------------------------------------------------------------
echo [4/6] Selecting restore commit...
echo.
echo Current commit:
git log -1 --oneline

echo.
echo The default restore target is the PREVIOUS commit:
echo     HEAD~1
echo.
echo If you know the exact commit that was working, you can enter
echo its commit hash instead.
echo.

set /p RESTORE_COMMIT=Enter restore commit [press ENTER for HEAD~1]: 

if "%RESTORE_COMMIT%"=="" set RESTORE_COMMIT=HEAD~1

echo.
echo Restore target:
git log -1 --oneline %RESTORE_COMMIT%

if errorlevel 1 (
    echo.
    echo ERROR: The specified commit does not exist.
    echo.
    echo Your backup is still available as:
    echo     %BACKUP_BRANCH%
    pause
    exit /b 1
)

echo.
echo ============================================================
echo WARNING
echo ============================================================
echo The current project is backed up as:
echo     %BACKUP_BRANCH%
echo.
echo The project will now be reset to:
git log -1 --oneline %RESTORE_COMMIT%
echo.
set /p CONFIRM=Continue with restore? Type YES to continue: 

if /I not "%CONFIRM%"=="YES" (
    echo.
    echo Restore cancelled.
    echo Your project was not changed.
    echo.
    echo Backup branch:
    echo     %BACKUP_BRANCH%
    pause
    exit /b 0
)

REM ------------------------------------------------------------
REM 6. Restore the selected commit
REM ------------------------------------------------------------
echo.
echo [5/6] Restoring project...
echo.

git reset --hard %RESTORE_COMMIT%

if errorlevel 1 (
    echo.
    echo ERROR: Restore failed.
    echo.
    echo You can return to the backup with:
    echo     git checkout %BACKUP_BRANCH%
    echo.
    pause
    exit /b 1
)

REM Remove untracked files that may have been introduced after
REM the working commit, but DO NOT remove the backup branch.
echo.
echo Cleaning untracked build files...
git clean -fd

echo.
echo [6/6] Restore completed.
echo.

echo ============================================================
echo                 RESTORE SUCCESSFUL
echo ============================================================
echo.
echo Restored commit:
git log -1 --oneline
echo.
echo Your previous state is safely stored in:
echo     %BACKUP_BRANCH%
echo.
echo If the restored version is NOT what you wanted, return to
echo the previous state with:
echo.
echo     git reset --hard %BACKUP_BRANCH%
echo.
echo IMPORTANT:
echo If you want to update GitHub with this restored version,
echo run:
echo.
echo     git push --force-with-lease origin HEAD
echo.
echo ============================================================
echo.

pause
endlocal
