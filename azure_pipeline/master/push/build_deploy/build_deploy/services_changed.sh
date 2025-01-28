source "$azureRootDir/azure_pipeline/shared/services.sh"

servicesUpdated=$(getUpdatedServices)
echo $servicesUpdated | jq -rM '.'
echo "##vso[task.setvariable variable=servicesUpdated]$servicesUpdated"