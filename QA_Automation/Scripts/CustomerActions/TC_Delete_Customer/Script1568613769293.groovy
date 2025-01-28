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
CustomKeywords.'commonUtils.CommonKeywords.login'()
WebUI.waitForElementVisible(findTestObject('Object Repository/LoginPage/div_Customer'),GlobalVariable.timeout)

CustomKeywords.'commonUtils.CommonKeywords.navigateToMenu'('Customers')

CustomKeywords.'customer.Common_CustomerKeywords.navigateToCustomerDetailspage'(2,2)
*/
CustomKeywords.'customer.Common_CustomerKeywords.delete_Customer'()

WebUI.waitForPageLoad(GlobalVariable.delay)
try{
WebUI.click(findTestObject('Object Repository/Customer_Page/input_SearchField'))
}
catch(Exception e)
{
	WebUI.click(findTestObject('Object Repository/Navigation Menu/link_customer'))
	WebUI.click(findTestObject('Object Repository/Customer_Page/input_SearchField'))
}

WebUI.sendKeys(findTestObject('Object Repository/Customer_Page/input_SearchField'),csv.getValue('customer',2))

WebUI.click(findTestObject('Object Repository/Customer_Page/button_Search'))

WebUI.waitForPageLoad(GlobalVariable.delay)

if(WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/verify_NoResultSearch'), GlobalVariable.timeout))
{
	
	System.out.println("-----------------------------Customer Has been Deleted Successfully----------------------")
	
}

else
{
	WebUI.verifyElementNotPresent(findTestObject('Object Repository/Customer_Page/verify_CustomerInSearch',[('email'):csv.getValue('emaillink',2),('customer'):csv.getValue('customer',2)]), GlobalVariable.timeout)
	System.out.println("-----------------------------Customer Has been Deleted Successfully----------------------")
}


