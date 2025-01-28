source "$azureRootDir/azure_pipeline/shared/services.sh"

for service in $(iterateChanges "$servicesUpdated")
do
    service=$(decode $service)
    echo "Running tests for $service..."
    (cd "$azureRootDir" && npm --prefix "$service" test)   
    echo -e "Testing Complete for $service...\n"
done
