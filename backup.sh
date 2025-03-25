#!/bin/bash

# Create timestamped backup directory
timestamp=$(date +"%Y%m%d_%H%M%S")
backup_dir="/Users/adamswansen/race_display_backups/backup_${timestamp}"

# Create backup directory if it doesn't exist
mkdir -p "/Users/adamswansen/race_display_backups"

# Copy files
cp -R /Users/adamswansen/race_display "${backup_dir}"

# Remove unnecessary files from backup
rm -rf "${backup_dir}/__pycache__"
rm -rf "${backup_dir}/*.pyc"
rm -rf "${backup_dir}/.DS_Store"
rm -rf "${backup_dir}/venv"

echo "Backup created at: ${backup_dir}"

# Create a list of backed up files
find "${backup_dir}" -type f > "${backup_dir}/backup_manifest.txt"

# Git status check
cd /Users/adamswansen/race_display
if git status --porcelain | grep -q '^'; then
    echo "⚠️  Warning: You have uncommitted changes in git"
    git status
else
    echo "✅ Git repository is clean"
fi 