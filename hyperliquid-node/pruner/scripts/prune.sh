#!/bin/bash
DATA_PATH="/home/hluser/hl/data"

# Folders to exclude from pruning
# Example: EXCLUDES=("visor_child_stderr" "rate_limited_ips" "node_logs")
EXCLUDES=("visor_child_stderr")

# Log startup for debugging
echo "$(date): Prune script started"

# Check if data directory exists
if [ ! -d "$DATA_PATH" ]; then
    echo "$(date): Error: Data directory $DATA_PATH does not exist."
    exit 1
fi

echo "$(date): Starting pruning process at $(date)"

# Get directory size before pruning
size_before=$(du -sh "$DATA_PATH" | cut -f1)
files_before=$(find "$DATA_PATH" -type f | wc -l)
echo "$(date): Size before pruning: $size_before with $files_before files"

# Build the exclusion part of the find command
EXCLUDE_EXPR=""
for name in "${EXCLUDES[@]}"; do
    EXCLUDE_EXPR+=" ! -name \"$name\""
done

# Delete data older than 24 hours = 60 minutes * 24 hours
HOURS=$((60*24))
eval "find \"$DATA_PATH\" -mindepth 1 -depth -mmin +$HOURS -type f $EXCLUDE_EXPR -delete"

# Get directory size after pruning
size_after=$(du -sh "$DATA_PATH" | cut -f1)
files_after=$(find "$DATA_PATH" -type f | wc -l)
echo "$(date): Size after pruning: $size_after with $files_after files"
echo "$(date): Pruning completed. Reduced from $size_before to $size_after ($(($files_before - $files_after)) files removed)."
