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

CustomKeywords.'commonUtils.CommonKeywords.opnBrowserandMaximize'()
CustomKeywords.'commonUtils.CommonKeywords.login'()
WebUI.waitForElementVisible(findTestObject('Object Repository/LoginPage/div_Customer'),GlobalVariable.timeout)

CustomKeywords.'commonUtils.CommonKeywords.navigateToMenu'('customer')

def favoriteCheck(int favoriteCheck) {
	
	int flag=0
	if(WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/Favorite/Fav_check_true'),10))
		{
			WebUI.doubleClick(findTestObject('Object Repository/Customer_Edit/Favorite/Fav_check_true'))

		}
		else 
		{
			int flag=1
			{
				WebUI.click(findTestObject('Object Repository/Customer_Edit/Favorite/link_Favorite'))
			}
			
			CustomKeywords.'commonUtils.CommonKeywords.navigateToMenu'('Customers')
			if(flag==0)
			{
				WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/Favorite/Fav_check_true'))
			}
			else
			{
				WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/Favorite/Fav_check_false'))
			}
			}
}




//CustomKeywords.'customer.Common_CustomerKeywords.navigateToCustomerDetailspage'(1,1)

//WebUI.delay(GlobalVariable.delay)
//WebUI.mouseOver(findTestObject('Object Repository/Customer_Edit/Favorite/link_Favorite'))
//WebUI.click(findTestObject('Object Repository/Customer_Edit/Favorite/link_Favorite'))

