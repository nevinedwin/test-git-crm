source "$azureRootDir/azure_pipeline/shared/templates.sh"

templatesUpdated=$(getUpdatedTemplates)
echo $templatesUpdated | jq -rM '.'
echo "##vso[task.setvariable variable=templatesUpdated]$templatesUpdated"