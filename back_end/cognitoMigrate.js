const fs = require('fs');
const fsPromises = fs.promises;

console.log("\n *START* \n");

var content = fs.readFileSync('./restored/us-west-2_jeE9MwyZI.json');
var parsedContent = JSON.parse(content);
var region = `us-west-2`;
var profile = `hyphen`;
var password = `Passw0rd!`;
var poolId = `us-west-2_66TIG6Qz1`;

initWriteFile();
async function initWriteFile() {
    await writeFile('#! /bin/bash\n');
    console.log(`parsedContent: ${parsedContent.length}`);
    for (let cognitoUser of parsedContent) {
        let emailVerfiedArr = cognitoUser.Attributes.filter(user => {
            return user.Name === "email_verified";
        });
        let emailVerfied = emailVerfiedArr && emailVerfiedArr.length ? emailVerfiedArr[0].Value : false;
        console.log(`emailVerfied: ${emailVerfied}`);
        if (cognitoUser.Enabled && emailVerfied) {
            let emailDet = cognitoUser.Attributes.filter(user => {
                return user.Name === "email";
            });
            let username = emailDet && emailDet.length ? emailDet[0].Value : '';
            let outputContent = `aws cognito-idp admin-set-user-password --user-pool-id ${poolId} --username ${username} --password ${password} --permanent --profile ${profile} --region ${region}\n`;
            console.log(`outputContent: ${outputContent}`);
            try {
                await writeFile(outputContent);
            }
            catch (e) {
                console.log(`e: ${e.message}`);
            }
        }
    }
}
async function writeFile(outputContent) {
    fsPromises.appendFile(`./cognitoSetPass.sh`, outputContent);
}