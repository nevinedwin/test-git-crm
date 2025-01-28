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
import org.openqa.selenium.Keys as Keys

def csv = findTestData('Dynamic_Data')

/*
CustomKeywords.'commonUtils.CommonKeywords.opnBrowserandMaximize'()
CustomKeywords.'commonUtils.CommonKeywords.login'(1,1)
//WebUI.waitForElementVisible(findTestObject('Object Repository/LoginPage/div_Customer'),GlobalVariable.timeout)

CustomKeywords.'commonUtils.CommonKeywords.navigateToMenu'('customer')


CustomKeywords.'customer.Common_CustomerKeywords.navigateToCustomerPagination'(csv.getValue('emaillink',2),csv.getValue('customer',2))
//CustomKeywords.'customer.Common_CustomerKeywords.navigateToCustomerPagination'(1, 1)


*/

CustomKeywords.'customer.Common_CustomerKeywords.editCustomer'()


CustomKeywords.'customer.Common_CustomerKeywords.editLeftPanelCustomer'(1,2,3,4)

/*
 * going back to customer list
*/

	WebUI.delay(4)
	WebUI.mouseOver(findTestObject('Object Repository/HomePage/image_HyphenLogo'))
	WebUI.click(findTestObject('Object Repository/HomePage/image_HyphenLogo'))


CustomKeywords.'customer.Common_CustomerKeywords.navigateToCustomerPagination'(csv.getValue('customerInfo',3),GlobalVariable.name)


WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'),Keys.chord(Keys.PAGE_UP))
WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/verifyDropdownValuesEdit',[('ddid'):csv.getValue('ddid2',1),('value'):csv.getValue('Stage',2)]),GlobalVariable.timeout)

//WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/verifyDropdownValuesEdit',[('ddid'):csv.getValue('ddid2',2),('value'):csv.getValue('Stage',2)]),GlobalVariable.timeout)

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/verifyDropdownValuesEdit',[('ddid'):csv.getValue('ddid2',3),('value'):csv.getValue('Grade',2)]),GlobalVariable.timeout)

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/verifyDropdownValuesEdit',[('ddid'):csv.getValue('ddid2',4),('value'):csv.getValue('Contactmethod',2)]),GlobalVariable.timeout)



WebUI.verifyElementNotPresent(findTestObject('Object Repository/Customer_Edit/verifyFeatureValuesEdit',[('text'):csv.getValue('interests',2)]),GlobalVariable.timeout)

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/verifyFeatureValuesEdit',[('text'):csv.getValue('influence',2)]),GlobalVariable.timeout)

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/verifyFeatureValuesEdit',[('text'):csv.getValue('influence',3)]),GlobalVariable.timeout)

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/verifyFeatureValuesEdit',[('text'):csv.getValue('Realtor',1)]),GlobalVariable.timeout)
WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'),Keys.chord(Keys.PAGE_DOWN))

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/verifyDesiredFeature',[('feature'):csv.getValue('Desiredfeatures',2)]),GlobalVariable.timeout)

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/verifyDesiredFeature',[('feature'):csv.getValue('Desiredfeatures',3)]),GlobalVariable.timeout)

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/verifyDesiredFeature',[('feature'):csv.getValue('Move',2)]),GlobalVariable.timeout)




WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/Leftpanel/verifyNameEdit',[('Name'):GlobalVariable.name]),GlobalVariable.timeout)

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/Leftpanel/verifyMailandPhone',[('text'):csv.getValue('customerInfo',3)]),GlobalVariable.timeout)

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/Leftpanel/verifyMailandPhone',[('text'):csv.getValue('customerInfo',4)]),GlobalVariable.timeout)





