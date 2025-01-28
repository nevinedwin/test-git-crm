source "$azureRootDir/azure_pipeline/shared/templates.sh"

echo "Installing SAM-CLI"
sh -c "$(curl -fsSL https://raw.githubusercontent.com/Linuxbrew/install/master/install.sh)"
test -d ~/.linuxbrew && eval $(~/.linuxbrew/bin/brew shellenv)
test -d /home/linuxbrew/.linuxbrew && eval $(/home/linuxbrew/.linuxbrew/bin/brew shellenv)
test -r ~/.bash_profile && echo "eval \$($(brew --prefix)/bin/brew shellenv)" >>~/.bash_profile
echo "eval \$($(brew --prefix)/bin/brew shellenv)" >>~/.profile
brew --version
brew tap aws/tap
brew install aws-sam-cli
echo "SAM-CLI Installation Complete"

templates=$(allTemplates)
for template in ${templates[@]}
do
    template=$(decode $template)
    echo "Running tests for $template..."
    # aws cloudformation validate-template --template-body "file://$azureRootDir/$template"    
    echo "file://$azureRootDir/$template"
    sam validate -t $azureRootDir/$template
    echo -e "Testing Complete for $template...\n"
done