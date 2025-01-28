package customer

import static com.kms.katalon.core.checkpoint.CheckpointFactory.findCheckpoint
import static com.kms.katalon.core.testcase.TestCaseFactory.findTestCase
import static com.kms.katalon.core.testdata.TestDataFactory.findTestData
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import org.openqa.selenium.WebDriver as WebDriver
import org.openqa.selenium.WebElement
import com.kms.katalon.core.webui.driver.DriverFactory as DriverFactory
import com.kms.katalon.core.annotation.Keyword
import com.kms.katalon.core.checkpoint.Checkpoint
import com.kms.katalon.core.cucumber.keyword.CucumberBuiltinKeywords as CucumberKW
import com.kms.katalon.core.mobile.keyword.MobileBuiltInKeywords as Mobile
import com.kms.katalon.core.model.FailureHandling
import com.kms.katalon.core.testcase.TestCase
import com.kms.katalon.core.testdata.TestData
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI


import org.openqa.selenium.Keys as Keys
import java.util.List
import org.openqa.selenium.By
import org.openqa.selenium.JavascriptExecutor
import internal.GlobalVariable



public class Common_CustomerKeywords {

	commonUtils.CommonKeywords comKeywords = new commonUtils.CommonKeywords()

	/*
	 * Mouseover and click for Objects
	 */
	def mouseOverandClick(TestObject xpath) {

		WebUI.mouseOver(xpath)
		WebUI.click(xpath)
	}

	/*
	 * To expand activity timelie regardless of where the activity focus now
	 */
	def tryCatchForActEdit(TestObject xpath1,TestObject xpath2) {

		try {
			mouseOverandClick(xpath2)
		}

		catch(Exception e) {
			WebUI.click(xpath1)
			mouseOverandClick(xpath2)
		}
	}



	/*
	 * Navigate to create new customer
	 */

	@Keyword
	def go_to_NewCustomer() {

		comKeywords.navigateToMenu('customer')

		mouseOverandClick(findTestObject('Customer_Page/button_Create'))
		mouseOverandClick(findTestObject('Object Repository/Customer_Page/button_Creator_Add'))

		WebUI.waitForPageLoad(GlobalVariable.timeout)
		WebUI.verifyElementPresent(findTestObject('Object Repository/NewCustomer/text_fname'),GlobalVariable.delay)
	}



	/*
	 * Create new customer
	 /*
	 * Create Customer 
	 */
	@Keyword
	def create_Customer(String saveaction,int row) {

		addDetailsCreator(row)

		addRealtor(row)

		featureAdd(row)

		saveAction(saveaction)
	}




	/*
	 * Adding Realtor radio Button
	 */
	def addRealtor(int row) {
		def csv = findTestData('Dynamic_Data')
		WebUI.delay(GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/link_AddRealtor'))
		WebUI.click(findTestObject('Object Repository/NewCustomer/radio_RealtorValue',[('realtor'):csv.getValue('Realtor',row)]))
	}



	/*
	 * Feature Items for customer
	 */

	def featureAdd(int row) {
		def csv = findTestData('Dynamic_Data')

		//WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'),Keys.chord(Keys.PAGE_DOWN))
		WebUI.delay(GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('influence',row)]))


		WebUI.scrollToElement(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('interests',row)]), GlobalVariable.timeout)
		WebUI.delay(GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('interests',row)]))
		WebUI.scrollToElement(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('interests',row)]), GlobalVariable.timeout)
		WebUI.delay(GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('interests',1)]))

		WebUI.scrollToElement(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('Desiredfeatures',row)]), GlobalVariable.timeout)
		WebUI.delay(GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('Desiredfeatures',row)]))

		WebUI.scrollToElement(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('Move',row)]), GlobalVariable.timeout)
		WebUI.delay(GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('Move',row)]))
	}


	/*
	 * Function to Save, Cancel and Save and Add new based on input Action Method
	 */

	def saveAction(String saveAction) {

		int i
		if(saveAction.equalsIgnoreCase('Save')) {
			i =1
		}

		else if(saveAction.equalsIgnoreCase('Reset')) {
			i = 2
		}

		else if(saveAction.equalsIgnoreCase('Save and Add Another')) {
			i = 3
		}

		else {
			i = 4
		}
		def csv = findTestData('Dynamic_Data')
		WebUI.scrollToElement(findTestObject('Object Repository/NewCustomer/button_ActionDynamic',[('button'):csv.getValue('buttonAction',i)]), GlobalVariable.timeout)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/button_ActionDynamic',[('button'):csv.getValue('buttonAction',i)]))

		if(i==2 || i == 4) {
			if(WebUI.waitForElementVisible(findTestObject('Object Repository/NewCustomer/popup_Confirmation'), GlobalVariable.delay)) {

				WebUI.click(findTestObject('Object Repository/NewCustomer/popup_confirm_Ok'))
				WebUI.waitForPageLoad(GlobalVariable.timeout)
			}
		}
	}



	/*
	 * FUnction To add customer Details
	 */
	def addDetailsCreator(int row) {
		def csv = findTestData('Dynamic_Data')

		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_fname'),csv.getValue('Fname',row))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Lname'),csv.getValue('Lname',row))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),csv.getValue('Email',row))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Phone'),csv.getValue('Phone',row))

		WebUI.click(findTestObject('Object Repository/NewCustomer/dropdown_Stage'))
		WebUI.delay(GlobalVariable.delay)
		WebUI.click(findTestObject('NewCustomer/dd_ValuePickerDynamic',[('ddid'):csv.getValue('ddid',1),('value'):csv.getValue('Stage',row)]))
		WebUI.delay(GlobalVariable.delay)

		mouseOverandClick(findTestObject('Object Repository/NewCustomer/dd_Source'))
		WebUI.delay(GlobalVariable.delay)
		WebUI.click(findTestObject('NewCustomer/dd_ValuePickerDynamic',[('ddid'):csv.getValue('ddid',2),('value'):csv.getValue('Source',row)]))
		WebUI.delay(GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/dd_Grade'))
		WebUI.delay(GlobalVariable.delay)
		WebUI.click(findTestObject('NewCustomer/dd_ValuePickerDynamic',[('ddid'):csv.getValue('ddid',3),('value'):csv.getValue('Grade',row)]))
		WebUI.delay(GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'))
		WebUI.delay(GlobalVariable.delay)
		WebUI.click(findTestObject('NewCustomer/dd_ValuePickerDynamic',[('ddid'):csv.getValue('ddid',4),('value'):csv.getValue('Contactmethod',row)]))
	}



	/*
	 * Validation for customer create page for aesterisks and HTML 5 browser alert for tesxt fields
	 */
	@Keyword
	def validationTextFields(String saveaction,int row) {

		def csv = findTestData('Dynamic_Data')

		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_fname'),Keys.chord(Keys.PAGE_DOWN))
		WebUI.delay(GlobalVariable.delay)
		saveAction(saveaction)
		WebUI.delay(6)
		WebUI.scrollToElement(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):saveaction]), row)
		saveAction(saveaction)
		verifyAlertForfields(saveaction)
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifySpanAlertFname'))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_fname'),csv.getValue('Fname',row))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_fname'),Keys.chord(Keys.PAGE_DOWN))

		saveAction(saveaction)
		WebUI.verifyElementNotPresent(findTestObject('Object Repository/NewCustomer/verifySpanAlertFname'),GlobalVariable.delay)
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verify_SpanAlertLname'))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Lname'),csv.getValue('Lname',row))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_fname'),Keys.chord(Keys.PAGE_DOWN))

		verifyEmail(saveaction)

		saveAction(saveaction)
		WebUI.verifyElementNotPresent(findTestObject('Object Repository/NewCustomer/verifySpanEmailInvalidAlert'), GlobalVariable.delay)
		WebUI.verifyElementNotPresent(findTestObject('Object Repository/NewCustomer/verifySpanAlertEmail'),GlobalVariable.delay)
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifyAlertPhone'))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Phone'),csv.getValue('Phone',row))
		//WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_fname'),Keys.chord(Keys.PAGE_DOWN))


	}


	/*
	 * verifying alert for all mandatory fields
	 */

	def verifyAlertForfields(String saveaction) {

		saveAction(saveaction)
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_fname'),Keys.chord(Keys.PAGE_DOWN))
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifySpanAlertFname'))
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verify_SpanAlertLname'))
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifySpanAlertEmail'))
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifyAlertPhone'))
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifySpanAlertStage'))
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifySpanAlertSource'))
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifyAlertGrade'))
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifyAlertContactMethod'))
	}



	/*
	 * Function to verify email format in create customer pages
	 */
	def verifyEmail(String saveaction) {
		def csv = findTestData('Dynamic_Data')

		saveAction(saveaction)
		WebUI.verifyElementNotPresent(findTestObject('Object Repository/NewCustomer/verify_SpanAlertLname'),GlobalVariable.delay)
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifySpanAlertEmail'))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),csv.getValue('Email',3))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_fname'),Keys.chord(Keys.PAGE_DOWN))


		saveAction(saveaction)
		WebUI.verifyElementNotPresent(findTestObject('Object Repository/NewCustomer/verifySpanAlertEmail'),GlobalVariable.delay)
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifySpanEmailInvalidAlert'))
		WebUI.click(findTestObject('Object Repository/NewCustomer/text_Email'))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),Keys.chord(Keys.CONTROL,'a'))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),Keys.chord(Keys.BACK_SPACE))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),csv.getValue('Email',4))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_fname'),Keys.chord(Keys.PAGE_DOWN))

		saveAction(saveaction)
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifySpanEmailInvalidAlert'))
		WebUI.click(findTestObject('Object Repository/NewCustomer/text_Email'))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),Keys.chord(Keys.CONTROL,'a'))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),Keys.chord(Keys.BACK_SPACE))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),csv.getValue('Email',5))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_fname'),Keys.chord(Keys.PAGE_DOWN))

		saveAction(saveaction)
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifySpanEmailInvalidAlert'))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),Keys.chord(Keys.CONTROL,'a'))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),Keys.chord(Keys.BACK_SPACE))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),csv.getValue('Email',1))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_fname'),Keys.chord(Keys.PAGE_DOWN))
	}


	/*
	 * Verifying Email ALready exists alert and Dropdown alerts
	 *
	 */

	@Keyword
	def validationAlertForCustomerDropdowns(String saveaction,int row) {
		def csv = findTestData('Dynamic_Data')

		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'),Keys.chord(Keys.PAGE_DOWN))
		saveAction(saveaction)
		WebUI.verifyElementNotPresent(findTestObject('Object Repository/NewCustomer/verifyAlertPhone'),GlobalVariable.delay)
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifySpanAlertStage'))
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/dropdown_Stage'))
		WebUI.delay(GlobalVariable.delay)
		WebUI.click(findTestObject('NewCustomer/dd_ValuePickerDynamic',[('ddid'):csv.getValue('ddid',1),('value'):csv.getValue('Stage',row)]))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'),Keys.chord(Keys.PAGE_DOWN))
		saveAction(saveaction)
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifySpanAlertSource'))
		WebUI.verifyElementNotPresent(findTestObject('Object Repository/NewCustomer/verifySpanAlertStage'),GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/dd_Source'))
		WebUI.delay(GlobalVariable.delay)
		WebUI.click(findTestObject('NewCustomer/dd_ValuePickerDynamic',[('ddid'):csv.getValue('ddid',2),('value'):csv.getValue('Source',row)]))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'),Keys.chord(Keys.PAGE_DOWN))
		saveAction(saveaction)
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifyAlertGrade'))
		WebUI.verifyElementNotPresent(findTestObject('Object Repository/NewCustomer/verifySpanAlertSource'),GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/dd_Grade'))
		WebUI.delay(GlobalVariable.delay)
		WebUI.click(findTestObject('NewCustomer/dd_ValuePickerDynamic',[('ddid'):csv.getValue('ddid',3),('value'):csv.getValue('Grade',row)]))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'),Keys.chord(Keys.PAGE_DOWN))
		saveAction(saveaction)
		WebUI.verifyElementVisible(findTestObject('Object Repository/NewCustomer/verifyAlertContactMethod'))
		WebUI.verifyElementNotPresent(findTestObject('Object Repository/NewCustomer/verifyAlertGrade'),GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'))
		WebUI.delay(GlobalVariable.delay)
		WebUI.click(findTestObject('NewCustomer/dd_ValuePickerDynamic',[('ddid'):csv.getValue('ddid',4),('value'):csv.getValue('Contactmethod',row)]))

		emailIDexistsVerificationCustomer(saveaction)
	}

	def dummy(String fieldname) {
		WebDriver driver = DriverFactory.getWebDriver()
		//WebElement elem1 = driver.findElement(By.cssSelector("input:required"))
		WebElement inputElement = driver.findElement(By.name(fieldname));
		JavascriptExecutor js = (JavascriptExecutor) driver;
		boolean isRequired = (Boolean) js.executeScript("return arguments[0].required;",inputElement)
		if(isRequired )
		{
			System.out.println(fieldname+" Field is required")
		}
	}


	/*
	 * Verifying Aesterisk symbol next to mandatory fields
	 */
	@Keyword
	def aesteriskCheck(String saveaction)

	{
		def csv = findTestData('Dynamic_Data')

		WebUI.verifyElementPresent(findTestObject('Object Repository/NewCustomer/verify_Aesterisk',[('label'):'First Name']),10, FailureHandling.CONTINUE_ON_FAILURE)

		WebUI.verifyElementPresent(findTestObject('Object Repository/NewCustomer/verify_Aesterisk',[('label'):'Last Name']),10, FailureHandling.CONTINUE_ON_FAILURE)

		WebUI.verifyElementPresent(findTestObject('Object Repository/NewCustomer/verify_Aesterisk',[('label'):'Email']),10, FailureHandling.CONTINUE_ON_FAILURE)

		WebUI.verifyElementPresent(findTestObject('Object Repository/NewCustomer/verify_Aesterisk',[('label'):'Phone']),10, FailureHandling.CONTINUE_ON_FAILURE)

		WebUI.verifyElementPresent(findTestObject('Object Repository/NewCustomer/verify_Aesterisk',[('label'):'Stage']),10, FailureHandling.CONTINUE_ON_FAILURE)

		WebUI.verifyElementPresent(findTestObject('Object Repository/NewCustomer/verify_Aesterisk',[('label'):'Source']),10, FailureHandling.CONTINUE_ON_FAILURE)

		WebUI.verifyElementPresent(findTestObject('Object Repository/NewCustomer/verify_Aesterisk',[('label'):'Grade']),10, FailureHandling.CONTINUE_ON_FAILURE)

		WebUI.verifyElementPresent(findTestObject('Object Repository/NewCustomer/verify_Aesterisk',[('label'):'Contact Method']),10, FailureHandling.CONTINUE_ON_FAILURE)


		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'),Keys.chord(Keys.PAGE_DOWN))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'),Keys.chord(Keys.PAGE_DOWN))

		saveAction(saveaction)




	}


	def emailIDexistsVerificationCustomer(String saveaction)
	{
		def csv = findTestData('Dynamic_Data')

		try{
			WebUI.click(findTestObject('Object Repository/NewCustomer/text_Email'))
		}
		catch(Exception e)
		{
			mouseOverandClick(findTestObject('Object Repository/NewCustomer/text_Email'))
		}
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),Keys.chord(Keys.CONTROL,'a'))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),Keys.chord(Keys.BACK_SPACE))
		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/text_Email'),csv.getValue('Email',1))

		WebUI.scrollToElement(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):saveaction]), GlobalVariable.delay)
		WebUI.delay(GlobalVariable.delay)
		saveAction(saveaction)

		WebUI.waitForElementVisible(findTestObject('Object Repository/NewCustomer/verifyTextEmailIDexists'),GlobalVariable.delay)

	}

	/*
	 * Navigating to custpomer details if item is in first page
	 */
	@Keyword
	def navigateToCustomerDetailspage(int EmailRow, int CustomerRow) {


		def csv = findTestData('Dynamic_Data')

		mouseOverandClick(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):csv.getValue('emaillink',EmailRow),('customer'):csv.getValue('customer',CustomerRow)]))
		WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Page/text_Email',[('email'):csv.getValue('emaillink',EmailRow)]), GlobalVariable.delay)
	}



	/*
	 * Customer Details Navigation wrt pagination, will search for item in each page to find desired customer link
	 */
	@Keyword
	def navigateToCustomerPaginationTest(int EmailRow, int CustomerRow)
	{

		def csv = findTestData('Dynamic_Data')

		if(WebUI.waitForElementPresent(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):csv.getValue('emaillink',EmailRow),('customer'):csv.getValue('customer',CustomerRow)]),GlobalVariable.delay))
		{
			customerLinkver(EmailRow,CustomerRow)

		}

		else
		{
			while(WebUI.verifyElementClickable(findTestObject('Object Repository/Navigation Menu/button_NextPage')))
			{
				WebUI.click(findTestObject('Object Repository/Navigation Menu/button_NextPage'))
				if(WebUI.waitForElementPresent(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):csv.getValue('emaillink',EmailRow),('customer'):csv.getValue('customer',CustomerRow)]),GlobalVariable.delay))
				{
					WebUI.scrollToElement(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):csv.getValue('emaillink',EmailRow),('customer'):csv.getValue('customer',CustomerRow)]),GlobalVariable.delay)
					WebUI.click(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):csv.getValue('emaillink',EmailRow),('customer'):csv.getValue('customer',CustomerRow)]))
					WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Page/text_Email',[('email'):csv.getValue('emaillink',EmailRow)]), GlobalVariable.delay)
					break
				}
			}
		}
	}

	/*
	 * Navigate to customer details when there is pagination
	 */

	@Keyword
	def navigateToCustomerPagination(String EmailRow, String CustomerRow)
	{

		def csv = findTestData('Dynamic_Data')

		if(WebUI.waitForElementPresent(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):EmailRow,('customer'):CustomerRow]),GlobalVariable.delay))
		{
			customerLinkver(EmailRow,CustomerRow)

		}

		else
		{
			while(WebUI.verifyElementClickable(findTestObject('Object Repository/Navigation Menu/button_NextPage')))
			{
				WebUI.click(findTestObject('Object Repository/Navigation Menu/button_NextPage'))
				if(WebUI.waitForElementPresent(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):EmailRow,('customer'):CustomerRow]),GlobalVariable.delay))
				{
					WebUI.scrollToElement(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):EmailRow,('customer'):CustomerRow]),GlobalVariable.delay)
					WebUI.click(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):EmailRow,('customer'):CustomerRow]))
					WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Page/text_Email',[('email'):EmailRow]), GlobalVariable.delay)
					break
				}
			}
		}
	}








	/*
	 * Function to try catch LInk click
	 */
	def customerLinkver(String EmailRow,String CustomerRow)
	{
		def csv = findTestData('Dynamic_Data')

		try{
			mouseOverandClick(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):EmailRow,('customer'):CustomerRow]))
			WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Page/text_Email',[('email'):EmailRow]), GlobalVariable.delay)
		}
		catch(Exception e)
		{
			WebUI.scrollToElement(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):EmailRow,('customer'):CustomerRow]),GlobalVariable.delay)
			mouseOverandClick(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):EmailRow,('customer'):CustomerRow]))
			WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Page/text_Email',[('email'):EmailRow]), GlobalVariable.delay)

		}

	}



	/*
	 * Keyword for editing customer center Panel fields
	 * 
	 */
	@Keyword
	def editCustomer()
	{

		def csv = findTestData('Dynamic_Data')


		mouseOverandClick(findTestObject('Object Repository/NewCustomer/dropdown_Stage'))
		WebUI.delay(GlobalVariable.delay)
		//WebUI.click(findTestObject('NewCustomer/misc/dd_StageValue',[('Stage'):csv.getValue('Stage',1)]))
		WebUI.click(findTestObject('NewCustomer/dd_ValuePickerDynamic',[('ddid'):csv.getValue('ddid',1),('value'):csv.getValue('Stage',2)]))
		//WebUI.selectOptionByLabel(null, null, false)

		WebUI.delay(GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/dd_Grade'))
		WebUI.delay(GlobalVariable.delay)
		WebUI.click(findTestObject('NewCustomer/dd_ValuePickerDynamic',[('ddid'):csv.getValue('ddid',3),('value'):csv.getValue('Grade',2)]))

		WebUI.delay(GlobalVariable.delay)
		WebUI.mouseOver(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'))
		contactTry()
		WebUI.delay(GlobalVariable.delay)
		WebUI.click(findTestObject('NewCustomer/dd_ValuePickerDynamic',[('ddid'):csv.getValue('ddid',4),('value'):csv.getValue('Contactmethod',2)]))

		editInterestInfluenceRealtor()

		editDesFeatureMove()


	}

	def contactTry()
	{
		try{
			WebUI.click(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'))
		}
		catch(Exception e)
		{WebUI.click(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'))

		}
	}

	/*
	 * Interest, influence and Realtor field edit [function calling by Keyword editCustomer
	 * 
	 */

	def editInterestInfluenceRealtor()

	{
		def csv = findTestData('Dynamic_Data')
		WebUI.delay(GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/Customer_Edit/link_interest'))
		WebUI.click(findTestObject('Object Repository/Customer_Edit/checkbox_Dynamic',[('ddid'):csv.getValue('ddid',5),('value'):csv.getValue('interests',2)]))
		tryInterestclick()
		WebUI.delay(GlobalVariable.delay)
		WebUI.mouseOver(findTestObject('Object Repository/Customer_Edit/link_influence'))
		WebUI.click(findTestObject('Object Repository/Customer_Edit/link_influence'))
		WebUI.click(findTestObject('Object Repository/Customer_Edit/checkbox_Dynamic',[('ddid'):csv.getValue('ddid',6),('value'):csv.getValue('influence',2)]))
		WebUI.click(findTestObject('Object Repository/Customer_Edit/checkbox_Dynamic',[('ddid'):csv.getValue('ddid',6),('value'):csv.getValue('influence',3)]))
		WebUI.delay(GlobalVariable.delay)

		tryInfluenceclick()
		trylinkRealtorclick()

		WebUI.click(findTestObject('Object Repository/Customer_Edit/checkbox_Dynamic',[('ddid'):csv.getValue('ddid',7),('value'):csv.getValue('Realtor',1)]))
		WebUI.delay(GlobalVariable.delay)

		WebUI.refresh()
		WebUI.waitForPageLoad(GlobalVariable.delay)

	}

	def tryInterestclick()
	{
		try
		{
			WebUI.click(findTestObject('Object Repository/Customer_Edit/div_InterestClick'))
		}
		catch(Exception e)
		{
			WebUI.refresh()
		}
	}

	def tryInfluenceclick()
	{
		try
		{
			WebUI.click(findTestObject('Object Repository/Customer_Edit/div_influence_Click'))
		}
		catch(Exception e)
		{
			WebUI.refresh()
		}
	}

	def trylinkRealtorclick()
	{
		try
		{
			mouseOverandClick(findTestObject('Object Repository/Customer_Edit/link_Realtor'))
		}
		catch(Exception e)
		{
			WebUI.mouseOver(findTestObject('Object Repository/Customer_Edit/link_Realtor'))
			String realtor = WebUI.getText(findTestObject('Object Repository/Customer_Edit/link_Realtor'))

			WebUI.click(findTestObject('Object Repository/Customer_Edit/link_realtorConfirm',[('realtor'):realtor]))
		}
	}




	/*
	 * Feature fields Desired feature and Move values edit function calling by keyword editCustomer
	 */
	def editDesFeatureMove()

	{
		def csv = findTestData('Dynamic_Data')

		WebUI.scrollToElement(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('Desiredfeatures',2)]), GlobalVariable.timeout)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('Desiredfeatures',2)]))

		mouseOverandClick(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('Desiredfeatures',3)]))

		WebUI.sendKeys(findTestObject('Object Repository/NewCustomer/dd_ContactMethod'),Keys.chord(Keys.PAGE_DOWN))

		WebUI.scrollToElement(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('Move',2)]), GlobalVariable.timeout)
		mouseOverandClick(findTestObject('Object Repository/NewCustomer/check_feature_Dynamic',[('feature'):csv.getValue('Move',2)]))
	}



	/*
	 * LeftPanelEdit Customer details
	 */
	@Keyword
	def editLeftPanelCustomer(int fnameRow,int lnameRow,int emailRow,int phRow)
	{
		def csv = findTestData('Dynamic_Data')
		WebUI.click(findTestObject('Object Repository/Customer_Edit/Leftpanel/image_Edit'))
		WebUI.delay(3)
		String fname = csv.getValue('customerInfo',fnameRow)
		String lname = csv.getValue('customerInfo',lnameRow)

		GlobalVariable.name = fname+' '+lname
		WebUI.delay(5)

		WebUI.doubleClick(findTestObject('Object Repository/Customer_Edit/Leftpanel/editCustomerPersInfo',[('infoid'):csv.getValue('editDetails',1)]))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',1)]), Keys.chord(Keys.CONTROL,'a'))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',1)]), Keys.chord(Keys.BACK_SPACE))
		WebUI.delay(2)
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',1)]),csv.getValue('customerInfo',fnameRow))
		WebUI.click(findTestObject('Object Repository/Customer_Edit/Leftpanel/label_FirstName'))
		WebUI.delay(GlobalVariable.delay)


		WebUI.doubleClick(findTestObject('Object Repository/Customer_Edit/Leftpanel/editCustomerPersInfo',[('infoid'):csv.getValue('editDetails',2)]))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',2)]), Keys.chord(Keys.CONTROL,'a'))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',2)]), Keys.chord(Keys.BACK_SPACE))
		WebUI.delay(2)
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',2)]),csv.getValue('customerInfo',lnameRow))
		WebUI.click(findTestObject('Object Repository/Customer_Edit/Leftpanel/label_LastName'))
		WebUI.delay(GlobalVariable.delay)

		editPhandMail(emailRow,phRow)

		mouseOverandClick(findTestObject('Object Repository/HomePage/image_HyphenLogo'))

		mouseOverandClick(findTestObject('Object Repository/Customer_Page/link_CustomerName',[('email'):csv.getValue('customerInfo',emailRow),('customer'):GlobalVariable.name]))
		WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Page/text_Email',[('email'):csv.getValue('customerInfo',emailRow)]), GlobalVariable.delay)

	}

	/*
	 * Edit phone and email of customer
	 */
	def editPhandMail(int emailRow,int phRow)	{
		//WebUI.waitForElementNotVisible(findTestObject('Object Repository/progressBar'), GlobalVariable.delay)

		def csv = findTestData('Dynamic_Data')
		//WebUI.scrollToElement(findTestObject('Object Repository/Customer_Edit/Leftpanel/editCustomerPersInfo',[('infoid'):csv.getValue('editDetails',3)]), GlobalVariable.timeout)

		WebUI.doubleClick(findTestObject('Object Repository/Customer_Edit/Leftpanel/editCustomerPersInfo',[('infoid'):csv.getValue('editDetails',3)]))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',3)]), Keys.chord(Keys.CONTROL,'a'))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',3)]), Keys.chord(Keys.BACK_SPACE))
		WebUI.delay(2)
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',3)]),csv.getValue('customerInfo',emailRow))
		WebUI.click(findTestObject('Object Repository/Customer_Edit/Leftpanel/label_PhNumber'))
		WebUI.delay(GlobalVariable.delay)

		//WebUI.scrollToElement(findTestObject('Object Repository/Customer_Edit/Leftpanel/editCustomerPersInfo',[('infoid'):csv.getValue('editDetails',4)]), GlobalVariable.timeout)
		WebUI.doubleClick(findTestObject('Object Repository/Customer_Edit/Leftpanel/editCustomerPersInfo',[('infoid'):csv.getValue('editDetails',4)]))

		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',4)]), Keys.chord(Keys.CONTROL,'a'))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',4)]), Keys.chord(Keys.BACK_SPACE))
		WebUI.delay(2)
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Edit/test_Firstname',[('id'):csv.getValue('editDetails',4)]),csv.getValue('customerInfo',phRow))
		WebUI.click(findTestObject('Object Repository/Customer_Edit/Leftpanel/div_Click'))
		WebUI.delay(GlobalVariable.delay)


	}


	/*
	 * Delete Customer
	 */
	@Keyword
	def delete_Customer()
	{

		mouseOverandClick(findTestObject('Object Repository/Customer_Page/delete_Customer/img_delete_Customer'))
		WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/delete_Customer/button_ConfirmOk'),GlobalVariable.delay)
		WebUI.click(findTestObject('Object Repository/Customer_Page/delete_Customer/button_ConfirmOk'))

	}


	/*
	 * Create Meeting from Customer details page
	 */
	@Keyword
	def createMeeting(String action)
	{

		def csv = findTestData('Dynamic_Data')
		String time= System.currentTimeMillis();
		String MeetingName = csv.getValue('meetingValues',1)+time

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/create_Meeting',[('activityId'):csv.getValue('activityId',1)]))
		WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/activity/verifyCreateMeetingpanel'), GlobalVariable.delay)
		WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',1)]))
		WebUI.setText(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',1)]),MeetingName)

		WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',2)]))
		WebUI.click(findTestObject('Customer_Page/activity/dd_dynamicActivity',[('ddid'):csv.getValue('ddidMeeting',2),('text'):csv.getValue('meetingValues',2)]))
		WebUI.delay(3)


		WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',3)]))
		WebUI.click(findTestObject('Customer_Page/activity/dd_dynamicActivity',[('ddid'):csv.getValue('ddidMeeting',3),('text'):csv.getValue('meetingValues',3)]))
		WebUI.delay(3)

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/buttonCalendarDynamic',[('id'):csv.getValue('CreateMeeting',4)]))
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_CurrentDate'))
		WebUI.clickOffset(findTestObject('Object Repository/Customer_Page/activity/div_Clock'), 0, 5)
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_Ok'))

		WebUI.mouseOver(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',5)]))
		tryDurMeeting()
		WebUI.click(findTestObject('Customer_Page/activity/dd_dynamicActivity',[('ddid'):csv.getValue('ddidMeeting',5),('text'):csv.getValue('meetingValues',5)]))
		WebUI.delay(3)

		WebUI.sendKeys(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',2)]),Keys.chord(Keys.PAGE_DOWN))

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/editor_Text'))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Page/activity/input_editor_Text'),csv.getValue('meetingValues',6))
		WebUI.delay(3)

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]))

		WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/activity/alert_ActivitySuccessMsg'),GlobalVariable.delay)


		verifyMeetingCreated(MeetingName)


	}

	/*
	 * Try catch for duration dropdown for meeting create
	 */
	def tryDurMeeting()
	{
		def csv = findTestData('Dynamic_Data')
		try
		{
			WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',5)]))
		}

		catch(Exception e)
		{
			mouseOverandClick(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',5)]))
		}

	}



	/*
	 * Verifying create Meeting displays on page
	 */
	def verifyMeetingCreated(String MeetingName1)
	{

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'))
		WebUI.delay(3)
		WebUI.verifyElementPresent(findTestObject('Customer_Page/activity/verify_ActivityName',[('Meeting'):MeetingName1]),GlobalVariable.timeout)

	}

	/*
	 * Try ctach for duration dropdown sdff
	 */


	/*
	 * Creating note from Customer Page
	 * 
	 */
	@Keyword
	def createNote(String action)
	{

		def csv = findTestData('Dynamic_Data')
		String time= System.currentTimeMillis();
		String Subject = csv.getValue('noteValues',1)+time
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/create_Meeting',[('activityId'):csv.getValue('activityId',2)]))
		WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/activity/verify_CreateNoteForm'), GlobalVariable.delay)
		WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createNote',1)]))
		WebUI.setText(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createNote',1)]),Subject)


		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/editor_Text'))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Page/activity/input_editor_Text'),csv.getValue('noteValues',2))
		WebUI.delay(3)

		//WebUI.sendKeys(findTestObject('Object Repository/Customer_Page/activity/editor_Text',[('id'):csv.getValue('createNote',1)]),Keys.chord(Keys.PAGE_DOWN))


		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]))

		WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/activity/alert_ActivitySuccessMsg'),GlobalVariable.delay)

		verifyNoteCreated(Subject)

	}


	/*
	 * Verifying created note is showing on Page
	 */
	def verifyNoteCreated(String NoteName1)
	{

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'))
		WebUI.delay(3)
		WebUI.verifyElementPresent(findTestObject('Customer_Page/activity/verify_ActivityName',[('Meeting'):NoteName1]),GlobalVariable.timeout)

	}


	/*
	 * Creating Call in customer Activity
	 * 
	 */

	@Keyword
	def createCall(String action)
	{

		def csv = findTestData('Dynamic_Data')
		String time= System.currentTimeMillis();
		String Subject = csv.getValue('callValues',1)+time

		WebUI.scrollToElement(findTestObject('Object Repository/Customer_Page/activity/create_Meeting',[('activityId'):csv.getValue('activityId',3)]), GlobalVariable.timeout)

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/create_Meeting',[('activityId'):csv.getValue('activityId',3)]))
		WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/activity/verifyCreateCallPanel'), GlobalVariable.delay)
		WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createCall',1)]))
		WebUI.setText(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createCall',1)]),Subject)

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/buttonCalendarDynamic',[('id'):csv.getValue('createCall',2)]))
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_CurrentDate'))
		WebUI.clickOffset(findTestObject('Object Repository/Customer_Page/activity/div_Clock'), 0, 5)
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_Ok'))
		trycatchforcallDuration()
		WebUI.sendKeys(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',5)]),Keys.chord(Keys.PAGE_DOWN))

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/editor_Text'))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Page/activity/input_editor_Text'),csv.getValue('callValues',4))
		WebUI.delay(3)

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]))

		WebUI.verifyElementVisible(findTestObject('Object Repository/Customer_Page/activity/alert_ActivitySuccessMsg'))

		verifyCallCreated(Subject)

	}

	/*
	 * Try catch for duration dropdown
	 */
	def trycatchforcallDuration()
	{
		def csv = findTestData('Dynamic_Data')
		try{
			WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',5)]))
			WebUI.click(findTestObject('Customer_Page/activity/dd_dynamicActivity',[('ddid'):csv.getValue('ddidMeeting',5),('text'):csv.getValue('meetingValues',5)]))
			WebUI.delay(3)
		}
		catch(Exception e)
		{
			WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',5)]))
			WebUI.click(findTestObject('Customer_Page/activity/dd_dynamicActivity',[('ddid'):csv.getValue('ddidMeeting',5),('text'):csv.getValue('meetingValues',5)]))
			WebUI.delay(3)
		}
	}

	/*
	 * Verifying created call in page
	 */
	def verifyCallCreated(String CallName1)
	{

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'))
		WebUI.delay(3)
		WebUI.verifyElementPresent(findTestObject('Customer_Page/activity/verify_ActivityName',[('Meeting'):CallName1]),GlobalVariable.timeout)

	}

	/*
	 * Creating Task from customer activity screen
	 * 
	 */
	@Keyword
	def createTask(String action)
	{

		def csv = findTestData('Dynamic_Data')
		String time= System.currentTimeMillis();
		String Subject = csv.getValue('taskValues',1)+time

		WebUI.scrollToElement(findTestObject('Object Repository/Customer_Page/activity/create_Meeting',[('activityId'):csv.getValue('activityId',4)]), GlobalVariable.timeout)

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/create_Meeting',[('activityId'):csv.getValue('activityId',4)]))
		WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/activity/verify_CreateTaskPanel'), GlobalVariable.delay)
		tryCreateTaskclick()
		WebUI.setText(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createTask',1)]),Subject)

		WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createTask',2)]))
		WebUI.click(findTestObject('Customer_Page/activity/dd_dynamicActivity',[('ddid'):csv.getValue('ddidTask',2),('text'):csv.getValue('taskValues',2)]))
		WebUI.delay(3)

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/buttonCalendarDynamic',[('id'):csv.getValue('createTask',3)]))
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_CurrentDate'))
		WebUI.clickOffset(findTestObject('Object Repository/Customer_Page/activity/div_Clock'), 0, 5)
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_Ok'))
		WebUI.delay(3)

		WebUI.sendKeys(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createTask',2)]),Keys.chord(Keys.PAGE_DOWN))

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/editor_Text'))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Page/activity/input_editor_Text'),csv.getValue('taskValues',4))
		WebUI.delay(GlobalVariable.delay)
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]))

		WebUI.verifyElementVisible(findTestObject('Object Repository/Customer_Page/activity/alert_ActivitySuccessMsg'))

		verifyCallCreated(Subject)

	}

	def tryCreateTaskclick()
	{
		def csv = findTestData('Dynamic_Data')
		try{
			WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createTask',1)]))
		}
		catch(Exception e)
		{
			WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createTask',1)]))
		}
	}


	/*
	 * Verifying created Task in page
	 */
	def verifyTaskCreated(String TaskName1)
	{

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'))
		WebUI.delay(3)
		WebUI.verifyElementPresent(findTestObject('Customer_Page/activity/verify_ActivityName',[('Meeting'):TaskName1]),GlobalVariable.timeout)

	}


	/*
	 * Editing any Activity from All List
	 */
	@Keyword
	def editActivityTimeLineAll()
	{
		def csv = findTestData('Dynamic_Data')
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'))
		WebUI.delay(3)
		WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',1)]))




	}

	/*
	 * Editing Mail Activity from Righ side Timeline
	 * 
	 */

	@Keyword
	def editActivityTimeLineMail()
	{


		def csv = findTestData('Dynamic_Data')
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'))
		WebUI.delay(3)
		WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',2)]))




	}

	/*
	 * Editing Existing one note from RHS time line
	 */

	@Keyword
	def editActivityTimeLineNote(String action, String editSubject, String editNote)
	{

		def csv = findTestData('Dynamic_Data')
		mouseOverandClick(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'))
		WebUI.delay(GlobalVariable.delay)
		//mouseOverandClick(findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',3)]))

		tryCatchForActEdit(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'), findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',3)]))

		WebUI.delay(GlobalVariable.delay)
		if(!WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/ActivityEdit/message_NoData'),GlobalVariable.delay))
		{

			String Subject = WebUI.getText(findTestObject('Object Repository/Customer_Page/ActivityEdit/link_Itemclick'))
			String UpdatedSubject = Subject+editSubject
			WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/link_Itemclick'))
			WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/ActivityEdit/verify_EditActivityText',[('text'):csv.getValue('verifyEditActivity', 2)]),GlobalVariable.timeout)
			WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createNote',1)]))
			WebUI.clearText(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createNote',1)]))
			WebUI.sendKeys(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createNote',1)]),UpdatedSubject)

			WebUI.click(findTestObject('Object Repository/Customer_Page/activity/editor_Text'))
			WebUI.sendKeys(findTestObject('Object Repository/Customer_Page/activity/input_editor_Text'),editNote)
			WebUI.delay(3)

			WebUI.scrollToElement(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]), GlobalVariable.delay)
			WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]))

			WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/ActivityEdit/verify_ActivityupdatedAlertText'),GlobalVariable.delay)

			verifyNoteUpdated(UpdatedSubject)

		}

	}

	/*
	 * Verifying edited note is saved
	 */
	def verifyNoteUpdated(String UpdatedSubject)
	{


		def csv = findTestData('Dynamic_Data')
		WebUI.delay(3)
		WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',3)]))
		WebUI.delay(3)
		WebUI.verifyElementPresent(findTestObject('Customer_Page/activity/verify_ActivityName',[('Meeting'):UpdatedSubject]),GlobalVariable.timeout)

	}

	/*
	 * 
	 * Edit Meeting from timeline
	 */
	@Keyword
	def editActivityTimeLineMeeting(String action, String editSubject)
	{

		def csv = findTestData('Dynamic_Data')
		mouseOverandClick(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'))
		WebUI.delay(GlobalVariable.delay)
		//mouseOverandClick(findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',4)]))
		tryCatchForActEdit(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'),findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',4)]))
		WebUI.delay(GlobalVariable.delay)
		if(!WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/ActivityEdit/message_NoData'),GlobalVariable.delay))
		{

			String Subject = WebUI.getText(findTestObject('Object Repository/Customer_Page/ActivityEdit/link_Itemclick'))
			String UpdatedSubject = Subject+editSubject
			WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/link_Itemclick'))

			editValuesInMeeting(UpdatedSubject)

			WebUI.scrollToElement(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]), GlobalVariable.delay)
			WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]))

			WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/ActivityEdit/verify_ActivityupdatedAlertText'),GlobalVariable.timeout)

			verifyMeetingUpdated(UpdatedSubject)

		}




	}


	/*
	 * Function to edit fields in Meeting opeend to edit
	 */

	def editValuesInMeeting(String editSubject)

	{
		def csv = findTestData('Dynamic_Data')


		WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',1)]))
		WebUI.clearText(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',1)]))
		WebUI.setText(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',1)]),editSubject)

		WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',2)]))
		WebUI.click(findTestObject('Customer_Page/activity/dd_dynamicActivity',[('ddid'):csv.getValue('ddidMeeting',2),('text'):csv.getValue('meetingValues',7)]))
		WebUI.delay(GlobalVariable.delay)

		WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',3)]))
		WebUI.click(findTestObject('Customer_Page/activity/dd_dynamicActivity',[('ddid'):csv.getValue('ddidMeeting',3),('text'):csv.getValue('meetingValues',8)]))
		WebUI.delay(GlobalVariable.delay)
		mouseOverandClick(findTestObject('Object Repository/Customer_Page/activity/buttonCalendarDynamic',[('id'):csv.getValue('CreateMeeting',4)]))
		trycatchMeetingedit()
		WebUI.clickOffset(findTestObject('Object Repository/Customer_Page/activity/div_Clock'), 0, 5)
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_Ok'))

		mouseOverandClick(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',5)]))
		WebUI.click(findTestObject('Customer_Page/activity/dd_dynamicActivity',[('ddid'):csv.getValue('ddidMeeting',5),('text'):csv.getValue('meetingValues',10)]))
		WebUI.delay(GlobalVariable.delay)

		//WebUI.sendKeys(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',2)]),Keys.chord(Keys.PAGE_DOWN))

		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/editor_Text'))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Page/activity/input_editor_Text'),csv.getValue('meetingValues',11))
		WebUI.delay(GlobalVariable.delay)

	}

	/*
	 * Try catch for meeting edit click
	 */
	def trycatchMeetingedit()
	{

		try
		{
			WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/currentDate_EditSelect'))
		}
		catch(Exception e)
		{
			WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/edit_DateNew'))
		}
	}


	/*
	 * Verifying meeting is edited and saved and showing
	 */

	def verifyMeetingUpdated(String UpdatedSubject)
	{

		def csv = findTestData('Dynamic_Data')
		WebUI.delay(3)
		WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',4)]))
		WebUI.delay(3)
		WebUI.verifyElementPresent(findTestObject('Customer_Page/activity/verify_ActivityName',[('Meeting'):UpdatedSubject]),GlobalVariable.timeout)



	}

	/*
	 * Edit Timeline call
	 */

	@Keyword
	def editActivityTimeLineCall(String action, String editSubject)
	{

		def csv = findTestData('Dynamic_Data')
		mouseOverandClick(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'))
		WebUI.delay(3)
		//mouseOverandClick(findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',5)]))
		tryCatchForActEdit(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'),findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',5)]))
		if(!WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/ActivityEdit/message_NoData'),GlobalVariable.delay))
		{
			String Subject = WebUI.getText(findTestObject('Object Repository/Customer_Page/ActivityEdit/link_Itemclick'))
			String UpdatedSubject = Subject+editSubject
			WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/link_Itemclick'))
			mouseOverandClick(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createCall',1)]))
			WebUI.clearText(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createCall',1)]))
			WebUI.setText(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createCall',1)]),UpdatedSubject)
			WebUI.click(findTestObject('Object Repository/Customer_Page/activity/buttonCalendarDynamic',[('id'):csv.getValue('createCall',2)]))
			editDateCall()

			mouseOverandClick(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',5)]))
			WebUI.click(findTestObject('Customer_Page/activity/dd_dynamicActivity',[('ddid'):csv.getValue('ddidMeeting',5),('text'):csv.getValue('callValues',3)]))
			WebUI.delay(3)

			//WebUI.sendKeys(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('CreateMeeting',5)]),Keys.chord(Keys.PAGE_DOWN))

			WebUI.click(findTestObject('Object Repository/Customer_Page/activity/editor_Text'))
			WebUI.sendKeys(findTestObject('Object Repository/Customer_Page/activity/input_editor_Text'),csv.getValue('callValues',4))
			WebUI.delay(3)

			WebUI.scrollToElement(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]), GlobalVariable.delay)
			WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]))

			WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/ActivityEdit/verify_ActivityupdatedAlertText'),GlobalVariable.delay)

			verifyCallUpdated(UpdatedSubject)

		}


	}

	/*
	 * Edit date for call activity
	 */
	def editDateCall()
	{
		def csv = findTestData('Dynamic_Data')

		try
		{
			WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/currentDate_EditSelect'))
		}
		catch(Exception e)
		{
			WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/edit_DateNew'))
		}
		WebUI.clickOffset(findTestObject('Object Repository/Customer_Page/activity/div_Clock'), 0, 5)
		WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_Ok'))
	}


	/*
	 * verifying call is been uodated
	 */
	def verifyCallUpdated(String UpdatedSubject)
	{

		def csv = findTestData('Dynamic_Data')
		WebUI.delay(3)
		WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',5)]))
		WebUI.delay(3)
		WebUI.verifyElementPresent(findTestObject('Customer_Page/activity/verify_ActivityName',[('Meeting'):UpdatedSubject]),GlobalVariable.timeout)



	}



	/*
	 * Editing exisitng task from RHS timeline
	 */


	@Keyword
	def editActivityTimeLineTask(String action, String editSubject)
	{

		def csv = findTestData('Dynamic_Data')
		mouseOverandClick(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'))
		WebUI.delay(GlobalVariable.delay)
		//mouseOverandClick(findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',6)]))
		tryCatchForActEdit(findTestObject('Object Repository/Customer_Page/activity/toggle_Activity'),findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',6)]))
		if(!WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/ActivityEdit/message_NoData'),GlobalVariable.delay))
		{
			String Subject = WebUI.getText(findTestObject('Object Repository/Customer_Page/ActivityEdit/link_Itemclick'))
			String UpdatedSubject = Subject+editSubject
			WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/link_Itemclick'))

			WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createTask',1)]))
			WebUI.setText(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createTask',1)]),UpdatedSubject)

			WebUI.click(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createTask',2)]))
			WebUI.click(findTestObject('Customer_Page/activity/dd_dynamicActivity',[('ddid'):csv.getValue('ddidTask',2),('text'):csv.getValue('taskValues',5)]))

			tryclickDate()
			editDateCall()

			WebUI.sendKeys(findTestObject('Customer_Page/activity/activity_DynamicField',[('id'):csv.getValue('createTask',2)]),Keys.chord(Keys.PAGE_DOWN))

			trycatchTextEditor()

			WebUI.sendKeys(findTestObject('Object Repository/Customer_Page/activity/input_editor_Text'),csv.getValue('taskValues',6))
			WebUI.delay(3)

			WebUI.scrollToElement(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]), GlobalVariable.delay)
			WebUI.click(findTestObject('Object Repository/Customer_Page/activity/button_SaveAction',[('action'):action]))

			WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/ActivityEdit/verify_ActivityupdatedAlertText'),GlobalVariable.delay)

			verifyTaskUpdated(UpdatedSubject)


		}

	}

	def trycatchTextEditor()
	{
		try{
			WebUI.click(findTestObject('Object Repository/Customer_Page/activity/editor_Text'))
		}
		catch(Exception e)
		{
			mouseOverandClick(findTestObject('Object Repository/Customer_Page/activity/editor_Text'))
		}

	}




	/*
	 * Try catch for date field click
	 */
	def tryclickDate()
	{
		def csv = findTestData('Dynamic_Data')
		try{
			WebUI.click(findTestObject('Object Repository/Customer_Page/activity/buttonCalendarDynamic',[('id'):csv.getValue('createTask',3)]))
		}
		catch(Exception e)
		{
			mouseOverandClick(findTestObject('Object Repository/Customer_Page/activity/buttonCalendarDynamic',[('id'):csv.getValue('createTask',3)]))
		}
	}

	/*
	 * verifying created task is updated
	 */
	def verifyTaskUpdated(String UpdatedSubject)
	{
		def csv = findTestData('Dynamic_Data')
		WebUI.delay(3)
		WebUI.click(findTestObject('Object Repository/Customer_Page/ActivityEdit/image_dynamicItem',[('id'):csv.getValue('activityEditid',6)]))
		WebUI.delay(3)
		WebUI.verifyElementPresent(findTestObject('Customer_Page/activity/verify_ActivityName',[('Meeting'):UpdatedSubject]),GlobalVariable.timeout)

	}

	@Keyword
	def favoriteCheck(int favoriteCheck) {


		int flag=0
		if(WebUI.waitForElementPresent(findTestObject('Object Repository/Customer_Edit/Favorite/Fav_check_true'),10))
		{
			WebUI.click(findTestObject('Object Repository/Customer_Edit/Favorite/Fav_check_true'))

		}
		else
		{
			flag=1

			WebUI.click(findTestObject('Object Repository/Customer_Edit/Favorite/link_Favorite'))
		}



		comKeywords.navigateToMenu('Customer')


		if(flag==0)
		{
			WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/Favorite/Fav_check_true'),GlobalVariable.delay)
		}
		else
		{
			WebUI.verifyElementPresent(findTestObject('Object Repository/Customer_Edit/Favorite/Fav_check_false'),GlobalVariable.delay)
		}
	}





}
