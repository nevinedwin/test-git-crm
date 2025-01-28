source "$azureRootDir/azure_pipeline/shared/services.sh"

for service in $(iterateVersionedChanges "$servicesUpdated")
do
    service=($(decode $service))
    version="${service[1]}"
    service=$(decode "${service[0]}")
    echo "Installing packages for $service..."
    (cd "$azureRootDir" && npm --no-package-lock --prefix "$service" install)
    echo -e "Build complete for $service...\n"
    packageService "$service" "$version"
done
