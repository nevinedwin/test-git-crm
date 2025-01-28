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


/*
 * For Individual TC runs added Log in
 */
def csv = findTestData('Dynamic_Data')
/*
CustomKeywords.'commonUtils.CommonKeywords.opnBrowserandMaximize'()
CustomKeywords.'commonUtils.CommonKeywords.login'(1,1)
WebUI.waitForElementVisible(findTestObject('Object Repository/LoginPage/div_Customer'),GlobalVariable.timeout)
*/

CustomKeywords.'commonUtils.CommonKeywords.navigateToMenu'('customer')


CustomKeywords.'customer.Common_CustomerKeywords.navigateToCustomerPagination'(csv.getValue('emaillink',2),csv.getValue('customer',2))


//CustomKeywords.'commonUtils.CommonKeywords.logout'()


//WebUI.closeBrowser()

