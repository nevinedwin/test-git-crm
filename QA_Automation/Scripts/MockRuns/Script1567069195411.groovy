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


CustomKeywords.'commonUtils.CommonKeywords.opnBrowserandMaximize'()
CustomKeywords.'commonUtils.CommonKeywords.login'(1,1)

//WebUI.waitForElementVisible(findTestObject('Object Repository/LoginPage/div_Customer'),GlobalVariable.timeout)

//CustomKeywords.'commonUtils.CommonKeywords.search'(3, 3)


/*
WebUI.openBrowser('')

WebUI.navigateToUrl('http://d116b2r2477nnc.cloudfront.net/login')

WebUI.click(findTestObject('Page_Hyphen Solutions CRM/div_Login'))

WebUI.setText(findTestObject('Page_Hyphen Solutions CRM/input_Login_username'), 'deepak.pc@inapp.com')

WebUI.setEncryptedText(findTestObject('Page_Hyphen Solutions CRM/input_Login_password'), 'P22/mDurbpKC5s/IkMN98A==')

WebUI.sendKeys(findTestObject('Page_Hyphen Solutions CRM/input_Login_password'), Keys.chord(Keys.ENTER))
*/

/*
WebUI.delay(GlobalVariable.delay)
*/
WebUI.delay(6)
CustomKeywords.'customer.Common_CustomerKeywords.go_to_NewCustomer'()

WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),csv.getValue('Email',3))


WebUI.click(findTestObject('Object Repository/NewCustomer/text_Email'))
//WebUI.clearText(findTestObject('Object Repository/NewCustomer/text_Email'))
WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),Keys.chord(Keys.CONTROL,'a'))
WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),Keys.chord(Keys.BACK_SPACE))
WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),csv.getValue('Email',4))

//CustomKeywords.'customer.Common_CustomerKeywords.aesteriskCheck'('Reset')

//CustomKeywords.'customer.Common_CustomerKeywords.validationTextFields'('Save')

//CustomKeywords.'customer.Common_CustomerKeywords.navigateToCustomerDetailspage'(1,1)
WebUI.delay(5)
//CustomKeywords.'customer.Common_CustomerKeywords.navigateToCustomerPagination'(1, 1)
//WebUI.click(findTestObject('Page_Hyphen Solutions CRM/span_Andy Miller'))

//CustomKeywords.'customer.Common_CustomerKeywords.editActivityTimeLineNote'('Save', 'Edited', 'Note Edited')

///CustomKeywords.'customer.Common_CustomerKeywords.editActivityTimeLineMeeting'('Save', 'Edited')

//CustomKeywords.'customer.Common_CustomerKeywords.editActivityTimeLineCall'('Save', ' Call edite')
//CustomKeywords.'customer.Common_CustomerKeywords.editActivityTimeLineTask'('Save', ' Editedask')

//CustomKeywords.'customer.Common_CustomerKeywords.createCall'('Save')

//CustomKeywords.'customer.Common_CustomerKeywords.createTask'('Save')

//CustomKeywords.'commonUtils.CommonKeywords.search'(3, 3)
/*
CustomKeywords.'customer.Common_CustomerKeywords.editLeftPanelCustomer'(1,2,3,4)

WebUI.delay(3)

WebUI.verifyTextPresent(csv.getValue('customerInfo',1), false)
WebUI.verifyTextPresent(csv.getValue('customerInfo',2), false)
WebUI.verifyTextPresent(csv.getValue('customerInfo',3), false)
WebUI.verifyTextPresent(csv.getValue('customerInfo',4), false)

/*
WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/Leftpanel/verifyNameEdit',[('Name'):GlobalVariable.name]),GlobalVariable.timeout)

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/Leftpanel/verifyMailandPhone',[('text'):csv.getValue('customerInfo',3)]),GlobalVariable.timeout)

WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/Leftpanel/verifyMailandPhone',[('text'):csv.getValue('customerInfo',4)]),GlobalVariable.timeout)

*/

//CustomKeywords.'customer.Common_CustomerKeywords.createMeeting'('Save')
