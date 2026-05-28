
CREATE VIEW pbi.MapBudgetProject AS
SELECT [BudgetId]
      ,[ProjectId]
      ,[ProjectBudgetH]
      ,[ProjectBudgetEUR]
      ,[AllocationStartDate]
      ,[AllocationEbdDate]
      ,[Priority]
	  ,BUD.CustomerId
  FROM [budget].[Map_Budget_Project] MAP LEFT JOIN [budget].[Budget] BUD ON MAP.[BudgetId] = BUD.Id

GO

