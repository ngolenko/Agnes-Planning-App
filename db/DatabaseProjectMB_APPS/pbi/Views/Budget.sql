


CREATE VIEW [pbi].[Budget] AS 
SELECT B.[Id] BudgetId
      ,[CustomerId]
	  ,CustomerName
      ,[Name]
      ,[ExternalName]
      ,[StartDate]
      ,[EndDate]
      ,[BudgetH]
      ,[BudgetEUR]
  FROM [budget].[Budget] B inner join budget.Customer C on B.CustomerId = C.Id

GO

