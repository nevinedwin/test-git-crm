source "$azureRootDir/azure_pipeline/shared/templates.sh"

for template in $(iterateVersionedChanges "$templatesUpdated")
do
    template=($(decode $template))
    version="${template[1]}"
    template=$(decode "${template[0]}")
    echo "Packaging $template..."
    packageTemplate "$template" "$version"
done