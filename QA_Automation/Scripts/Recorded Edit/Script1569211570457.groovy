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

WebUI.openBrowser('')

WebUI.navigateToUrl('http://d116b2r2477nnc.cloudfront.net/login')

WebUI.click(findTestObject('Page_Hyphen Solutions CRM/div_Login'))

CustomKeywords.'commonUtils.CommonKeywords.mouseOverandClick'(findTestObject('Object Repository/LoginPage/text_Email'))

WebUI.setText(findTestObject('Page_Hyphen Solutions CRM/input_Login_username'), 'deepak.pc@inapp.com')

WebUI.setEncryptedText(findTestObject('Page_Hyphen Solutions CRM/input_Login_password'), 'P22/mDurbpKC5s/IkMN98A==')

WebUI.sendKeys(findTestObject('Page_Hyphen Solutions CRM/input_Login_password'), Keys.chord(Keys.ENTER))

WebUI.click(findTestObject('Page_Hyphen Solutions CRM/button_Login'))

WebUI.click(findTestObject('Page_Hyphen Solutions CRM/span_Andy Miller'))

WebUI.click(findTestObject('Page_Hyphen Solutions CRM/svg_Andy Miller_MuiSvgIcon-root'))

//WebUI.click(findTestObject('Page_Hyphen Solutions CRM/span_Andy'))


try{
WebUI.doubleClick(findTestObject('Page_Hyphen Solutions CRM/span_Andy'))
WebUI.sendKeys(findTestObject('Page_Hyphen Solutions CRM/input_First Name_editDetail_firstName'), 'Kill')
WebUI.click(findTestObject('Object Repository/Customer_Edit/Leftpanel/label_LastName'))
}
catch(Exception e)
{
	WebUI.doubleClick(findTestObject('Page_Hyphen Solutions CRM/span_Andy'))
	WebUI.sendKeys(findTestObject('Page_Hyphen Solutions CRM/input_First Name_editDetail_firstName'), 'Kill')
	WebUI.click(findTestObject('Object Repository/Customer_Edit/Leftpanel/label_LastName'))
}

try{
WebUI.doubleClick(findTestObject('Page_Hyphen Solutions CRM/span_Miller'))
WebUI.sendKeys(findTestObject('Page_Hyphen Solutions CRM/input_Last Name_editDetail_lastName'), 'Mill')
WebUI.click(findTestObject('Object Repository/Customer_Edit/Leftpanel/label_LastName'))
}
catch(Exception e)
{
	WebUI.doubleClick(findTestObject('Page_Hyphen Solutions CRM/span_Miller'))
	WebUI.sendKeys(findTestObject('Page_Hyphen Solutions CRM/input_Last Name_editDetail_lastName'), 'Mill')
	WebUI.click(findTestObject('Object Repository/Customer_Edit/Leftpanel/label_LastName'))
}


WebUI.closeBrowser()

