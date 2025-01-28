source "$azureRootDir/azure_pipeline/shared/services.sh"

# Runs defined tests on all services in an application
services=$(allServices)
for service in ${services[@]}
do
    service=$(decode $service)
    echo "Running tests for $service..."
    (cd "$azureRootDir" && npm --prefix "$service" test)
    echo -e "Testing Complete for $service...\n"
done