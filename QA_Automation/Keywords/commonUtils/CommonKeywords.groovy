package commonUtils

import static com.kms.katalon.core.testdata.TestDataFactory.findTestData
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject

import com.kms.katalon.core.annotation.Keyword
import com.kms.katalon.core.model.FailureHandling
import com.kms.katalon.core.testdata.TestData
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI

import internal.GlobalVariable

public class CommonKeywords {

	@Keyword

	def login(int i, int j) {

		def csv = findTestData('Dynamic_Data')


		//def login(TestData csv) {
		WebUI.waitForElementVisible(findTestObject('Object Repository/LoginPage/text_Email'),GlobalVariable.timeout)
		WebUI.click(findTestObject('Object Repository/LoginPage/text_Email'))
		WebUI.sendKeys(findTestObject('Object Repository/LoginPage/text_Email'), csv.getValue('Username',i))
		WebUI.click(findTestObject('Object Repository/LoginPage/text_Password'))
		WebUI.sendKeys(findTestObject('Object Repository/LoginPage/text_Password'),csv.getValue('Password',j))
		WebUI.click(findTestObject('Object Repository/LoginPage/button_Submit'))
		WebUI.waitForPageLoad(GlobalVariable.timeout)
		WebUI.waitForElementPresent(findTestObject('Object Repository/LoginPage/image_userProfile'), GlobalVariable.timeout)
		System.out.println("--------------------------Log in successful-------------------------")
	}


	/*
	 * Verify Alert showing fpr empty fields when clicks Login
	 */

	@Keyword
	def login_with_no_credentials() {


		WebUI.click(findTestObject('Object Repository/LoginPage/button_Submit'))
		WebUI.verifyElementVisible(findTestObject('Object Repository/LoginPage/verifyUsernameValidation'), FailureHandling.STOP_ON_FAILURE)
		WebUI.verifyElementVisible(findTestObject('Object Repository/LoginPage/verifyPasswordValidation'), FailureHandling.STOP_ON_FAILURE)
	}


	/*
	 * Verify Alert showing if user leave password field in log in screen
	 */
	@Keyword
	def login_with_no_password() {

		def sheet = findTestData('Data Files/logindata')



		WebUI.setText(findTestObject('Object Repository/LoginPage/text_Email'), sheet.getValue("Login", 1))

		WebUI.click(findTestObject('Object Repository/LoginPage/button_Submit'))
		WebUI.verifyElementVisible(findTestObject('Object Repository/LoginPage/verifyPasswordValidation'), FailureHandling.STOP_ON_FAILURE)
	}

	/*
	 * Verify alert showing for invalid username in log in page
	 */
	@Keyword
	def login_with_invalid_credentials() {


		def sheet = findTestData('Data Files/logindata')


		WebUI.setText(findTestObject('Object Repository/LoginPage/text_Email'), sheet.getValue("Invalid_login", 1))

		WebUI.setText(findTestObject('Object Repository/LoginPage/text_Password'), sheet.getValue("Invalid_login",2))

		WebUI.click(findTestObject('Object Repository/LoginPage/button_Submit'))
		WebUI.verifyElementVisible(findTestObject('Object Repository/LoginPage/verifyInvalidCred'), FailureHandling.STOP_ON_FAILURE)
	}


	/*
	 * Function for mouse over and click
	 */

	def mouseOverandClick(TestObject Test) {

		WebUI.mouseOver(Test)
		WebUI.click(Test)
	}


	/*
	 * Opening browser and maximizes it
	 */

	@Keyword

	def opnBrowserandMaximize() {

		def csv = findTestData('Dynamic_Data')
		WebUI.openBrowser('')
		String URL = csv.getValue('URL',1)
		WebUI.navigateToUrl(URL)
		WebUI.maximizeWindow()
	}

	/*
	 * Logging out froom application
	 */

	@Keyword
	def logout() {

		WebUI.mouseOver(findTestObject('Object Repository/UserProfile/image_UserProfile'))
		WebUI.click(findTestObject('Object Repository/UserProfile/image_UserProfile'))
		WebUI.mouseOver(findTestObject('Object Repository/UserProfile/link_LogOut'))
		WebUI.click(findTestObject('Object Repository/UserProfile/link_LogOut'))
		WebUI.verifyElementPresent(findTestObject('Object Repository/LoginPage/text_Email'), GlobalVariable.timeout)
	}


	/*
	 * Navigate to menu(Customer, Realtor,Campaigns)
	 */
	@Keyword
	def navigateToMenu(String menuheader) {
		/*
		 * After Logging in to Account go to Customer
		 */

		if(WebUI.waitForElementVisible(findTestObject('Object Repository/Navigation Menu/verify_MenuFocus',[('menuheader'):menuheader]), GlobalVariable.timeout)) {
			System.out.println("Default Landing Page is "+menuheader+" List")
		}

		else {
			WebUI.mouseOver(findTestObject('Object Repository/Navigation Menu/link_Menu',[('menu'):menuheader]))
			WebUI.click(findTestObject('Object Repository/Navigation Menu/link_Menu',[('menu'):menuheader]))
			WebUI.verifyElementPresent(findTestObject('Object Repository/Navigation Menu/verify_MenuFocus',[('menuheader'):menuheader]), GlobalVariable.timeout)
		}
	}

	/*
	 * Home page search
	 */
	@Keyword
	def search(int keyword,int type) {
		def csv = findTestData('Dynamic_Data')

		WebUI.click(findTestObject('Object Repository/Customer_Page/header_Search'))
		WebUI.click(findTestObject('Object Repository/Customer_Page/input_SearchField'))
		WebUI.sendKeys(findTestObject('Object Repository/Customer_Page/input_SearchField'),csv.getValue('searchKeyword',keyword))
		if(WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/dd_SearchType'), GlobalVariable.timeout)) {
			WebUI.click(findTestObject('Object Repository/Customer_Page/dd_SearchType'))
			WebUI.click(findTestObject('Object Repository/Customer_Page/dd_SearchMenuTypeDyn',[('type'):csv.getValue('searchType',type)]))
		}
		WebUI.mouseOver(findTestObject('Object Repository/Customer_Page/button_Search'))
		WebUI.click(findTestObject('Object Repository/Customer_Page/button_Search'))

		WebUI.waitForPageLoad(GlobalVariable.delay)

		if(WebUI.waitForElementVisible(findTestObject('Object Repository/Customer_Page/verify_NoResultSearch'), GlobalVariable.timeout)) {

			System.out.println("-----------------------------No search Result----------------------")
		}

		else {
			WebUI.verifyTextPresent(csv.getValue('searchKeyword',keyword), false)
			String Actual = WebUI.getText(findTestObject('Object Repository/Customer_Page/header_Search_RsltText'))
			System.out.println(Actual)
			String Expected = "Search results for '"+csv.getValue('searchKeyword',keyword)+"' in "+csv.getValue('searchType',type)
			System.out.println(Expected)
			if(Actual.equals(Expected)) {
				System.out.println("----------------Search For the entered keyword on Search Type worked-------------")
			}
		}
	}
}
