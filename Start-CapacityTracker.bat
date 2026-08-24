@echo off
title Capacity Tracker
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-CapacityTracker.ps1"
pause
