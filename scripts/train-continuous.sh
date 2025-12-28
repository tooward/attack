#!/bin/bash
# Continuous Training Script
# Runs training in a loop, each session trains for 10M steps
# Press Ctrl+C to stop

echo "=== Continuous Training Mode ==="
echo "This will train the model indefinitely in 10M step increments"
echo "Each session continues from the previous checkpoint"
echo "Press Ctrl+C to stop"
echo ""

# Trap Ctrl+C to exit cleanly
trap 'echo -e "\n\n✓ Training stopped by user"; exit 0' INT

iteration=1
total_steps=0

while true; do
  echo "=========================================="
  echo "Training Session #$iteration"
  echo "Total steps so far: $total_steps"
  echo "=========================================="
  echo ""
  
  # Run training
  npm run train
  
  # Check if training completed successfully
  if [ $? -eq 0 ]; then
    total_steps=$((total_steps + 10000000))
    echo ""
    echo "✓ Session #$iteration complete"
    echo "Total trained: $total_steps steps"
    echo ""
    iteration=$((iteration + 1))
    
    # Brief pause between sessions
    sleep 2
  else
    echo "✗ Training failed or was interrupted"
    exit 1
  fi
done
