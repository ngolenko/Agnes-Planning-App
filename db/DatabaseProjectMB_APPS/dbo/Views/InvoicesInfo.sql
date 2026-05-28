CREATE VIEW dbo.InvoicesInfo AS
SELECT c.CustomerName, b.Name as BudgetName, b.StartDate as BudgetStartDate, b.EndDate as BudgetEndDate, b.BudgetH, b.BudgetEUR, 
	i.id as InvoiceId, i.InvoiceNumber, i.InvoiceDate, i.InvoicePeriodFrom, i.InvoicePeriodTo,	p.ProjectName
FROM [budget].[Customer] c
	INNER JOIN [budget].[Budget] b on c.Id = b.CustomerId
	INNER JOIN [budget].[Invoice] i  on c.Id = i.CustomerId AND i.BudgetId = b.Id
	INNER JOIN budget.Project p on i.ProjectId = p.Id

GO

