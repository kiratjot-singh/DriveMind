#!/bin/bash
# DriveMind Database Restore Script

set -e

# Load environment variables if backend .env exists
if [ -f "backend/.env" ]; then
  export $(grep -v '^#' backend/.env | xargs)
fi

if [ -z "$1" ]; then
  echo "Error: Please specify the backup directory path to restore from."
  echo "Usage: ./scripts/restore-db.sh backups/YYYY-MM-DD_HHMMSS"
  exit 1
fi

BACKUP_DIR=$1

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Error: Backup directory not found at $BACKUP_DIR"
  exit 1
fi

echo "================================================="
echo "Starting DriveMind database restore..."
echo "Source: $BACKUP_DIR"
echo "================================================="

# 1. Restore MongoDB
if [ -d "$BACKUP_DIR/mongo" ]; then
  if [ -n "$MONGO_URI" ]; then
    echo "Restoring MongoDB..."
    mongorestore --uri="$MONGO_URI" "$BACKUP_DIR/mongo"
    echo "MongoDB restore completed."
  else
    echo "ERROR: MONGO_URI not defined. Cannot restore MongoDB."
    exit 1
  fi
else
  echo "No MongoDB dump found in $BACKUP_DIR/mongo. Skipping MongoDB restore."
fi

# 2. Restore Neo4j metadata info
if [ -f "$BACKUP_DIR/neo4j_info.txt" ]; then
  echo "Neo4j metadata file found."
  cat "$BACKUP_DIR/neo4j_info.txt"
fi

echo "================================================="
echo "Database restore completed successfully!"
echo "================================================="
