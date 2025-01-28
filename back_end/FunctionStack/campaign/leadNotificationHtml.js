export const notificationEmailTemplate = (leadData, builderName = "", isHtml = true) => {

	let body;

	if (isHtml) {
		body = `
			<html>
				<head>
					<style>
						body {
							font-family: Arial, sans-serif;
							line-height: 1.6;
							background-color: #f4f6f8;
							padding: 20px;
							color: #333;
						}
						.container {
							max-width: 600px;
							margin: auto;
							background-color: #ffffff;
							padding: 20px;
							border-radius: 8px;
							box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
						}
						.header {
							text-align: center;
							padding-bottom: 20px;
							border-bottom: 1px solid #888;
						}
						.header h1 {
							color: #F47621;
						}
						.content {
							padding: 20px 0;
						}
						table {
							width: 100%;
							border-collapse: collapse;
						}
						table th, table td {
							text-align: left;
							padding: 12px;
							border-bottom: 1px solid #ddd;
						}
						table th {
							background-color: #F47621;
							color: #ffffff;
						}
						.footer {
							text-align: center;
							padding-top: 20px;
							font-size: 14px;
							color: #888;
						}
						.border-none {
							border: none
						}
					</style>
				</head>
				<body>
					<div class="container">
						<div class="header">
							<h1>New Lead Notification</h1>
							<p>A new lead has been added in <strong>${builderName}</strong>.</p>
						</div>
						<div class="content">
							<table>
								<thead>
									<tr>
										<th>Key</th>
										<th>Details</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td><strong>Name</strong></td>
										<td>${leadData?.name || ''}</td>
									</tr>
									${leadData.email &&
										`<tr>
											<td><strong>Email</strong></td>
											<td>${leadData?.email || ''}</td>
										</tr>`
									}
									${leadData.phone &&
										`<tr>
											<td><strong>Phone</strong></td>
											<td>${leadData.phone}</td>
										</tr>`
										}
									${leadData.community &&
										`<tr>
											<td><strong>Community Interest</strong></td>
											<td>${leadData.community}</td>
										</tr>`
										}
									${leadData.source &&
										`<tr>
											<td><strong>Source</strong></td>
											<td>${leadData.source}</td>
										</tr>`
										}
									<tr>
											<td><strong>Date Added</strong></td>
											<td>${leadData.date}</td>
									</tr>
									${leadData.notes &&
										`<tr>
											<td><strong>Notes</strong></td>
											<td>
												<table>
													<tr>
														<td class="border-none">Subject:</td>
														<td class="border-none">${leadData?.notes?.noteSub || ''}</td>
													</tr>
													<tr>
														<td class="border-none">Note:</td>
														<td class="border-none">${leadData?.notes?.note || ''}</td>
													</tr>
												</table>
											</td>
										</tr>`
									}
								</tbody>
							</table>
						</div>
						<div class="footer">
							<p>Please take the necessary actions to follow up with this lead promptly.</p>
							<p>Thank you,<br>${builderName}</p>
						</div>
					</div>
				</body>
			</html>`
	} else {
		body = `New Lead Notification\n\n
			A new lead has been added in ${builderName}.\n\n
			Name: ${leadData.name}\n
			${leadData.email && `Email: ${leadData.email}\n`}
			${leadData.phone && `Phone: ${leadData.phone}\n`}
			${leadData.community && `Community Interest: ${leadData.community}\n`}
			${leadData.source && `Source: ${leadData.source}\n`}
			${leadData.cdt && `Date Added: ${leadData.date}\n`}
			${leadData.notes && `Notes:\n Subject: ${leadData?.notes?.noteSub || ''}\n Note: ${leadData?.notes?.note}\n`}
			\nPlease take the necessary actions to follow up with this lead promptly.\n
			Thank you,\n${builderName}`
	}

	return body;
};