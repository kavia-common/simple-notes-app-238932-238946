#!/bin/bash
cd /tmp/kavia/workspace/code-generation/simple-notes-app-238932-238946/frontend_web_app
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

