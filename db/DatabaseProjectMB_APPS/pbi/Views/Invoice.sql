
CREATE VIEW pbi.Invoice AS 


SELECT [Id] InvoiceId
      ,[BudgetId]
      ,[ProjectId]
      ,[CustomerId]
      ,[InvoiceNumber]
      ,[InvoiceDate]
      ,[InvoicePeriodFrom]
      ,[InvoicePeriodTo]
      ,[InvoicedH]
      ,[InvoicedEUR]
  FROM [budget].[Invoice]

GO

