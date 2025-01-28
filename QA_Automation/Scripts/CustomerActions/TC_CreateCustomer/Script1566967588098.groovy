import static com.kms.katalon.core.checkpoint.CheckpointFactory.findCheckpoint
import static com.kms.katalon.core.testcase.TestCaseFactory.findTestCase
import static com.kms.katalon.core.testdata.TestDataFactory.findTestData
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import com.kms.katalon.core.checkpoint.Checkpoint as Checkpoint
import com.kms.katalon.core.cucumber.keyword.CucumberBuiltinKeywords as CucumberKW
import com.kms.katalon.core.mobile.keyword.MobileBuiltInKeywords as Mobile
import com.kms.katalon.core.model.FailureHandling as FailureHandling
import com.kms.katalon.core.testcase.TestCase as TestCase
import com.kms.katalon.core.testdata.TestData as TestData
import com.kms.katalon.core.testobject.TestObject as TestObject
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import internal.GlobalVariable as GlobalVariable

def csv = findTestData('Dynamic_Data')

/*
 CustomKeywords.'commonUtils.CommonKeywords.opnBrowserandMaximize'()
 CustomKeywords.'commonUtils.CommonKeywords.login'(1,1)
 //WebUI.waitForElementVisible(findTestObject('Object Repository/LoginPage/div_Customer'),GlobalVariable.timeout)
 WebUI.delay(6)
 */

CustomKeywords.'commonUtils.CommonKeywords.navigateToMenu'('customer')
CustomKeywords.'customer.Common_CustomerKeywords.go_to_NewCustomer'()


CustomKeywords.'customer.Common_CustomerKeywords.create_Customer'('Save',2)

WebUI.waitForPageLoad(GlobalVariable.timeout)

if(WebUI.waitForElementVisible(findTestObject('Object Repository/NewCustomer/verify_CustomerCreated'),GlobalVariable.timeout))
{
	WebUI.delay(2)
	WebUI.verifyTextPresent(csv.getValue('Fname',2), false)
	WebUI.verifyTextPresent(csv.getValue('Lname',2), false)
	WebUI.verifyTextPresent(csv.getValue('Email',2), false)
	WebUI.verifyTextPresent(csv.getValue('Phone',2), false)

}
else if(!WebUI.waitForElementNotVisible(findTestObject('Object Repository/NewCustomer/verifyTextEmailIDexists'),GlobalVariable.timeout))
{
	System.out.println("-------------------------Create Customer Failed as Email ID exists-----------")
}

else
{
	System.out.println("-------------------------TC Create Customer Failed -----------")
}

