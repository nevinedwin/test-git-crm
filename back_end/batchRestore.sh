#! /bin/bash
for fileName in restored/batchRequest_*
do 
    RESTORE_FILE=$fileName
    echo $RESTORE_FILE
    aws dynamodb batch-write-item --request-items file://$RESTORE_FILE --region us-west-2 --profile hyphen
done