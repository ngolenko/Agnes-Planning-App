CREATE TABLE [budget].[Map_Budget_Project] (
    [BudgetId]            INT             NOT NULL,
    [ProjectId]           INT             NOT NULL,
    [ProjectBudgetH]      DECIMAL (18, 2) NULL,
    [ProjectBudgetEUR]    DECIMAL (18, 2) NULL,
    [AllocationStartDate] DATE            NULL,
    [AllocationEbdDate]   DATE            NULL,
    [Priority]            TINYINT         NULL,
    CONSTRAINT [PK_Map_Budget_Project] PRIMARY KEY CLUSTERED ([BudgetId] ASC, [ProjectId] ASC),
    CONSTRAINT [FK_Map_Budget_Project_Budget] FOREIGN KEY ([BudgetId]) REFERENCES [budget].[Budget] ([Id]),
    CONSTRAINT [FK_Map_Budget_Project_Project] FOREIGN KEY ([ProjectId]) REFERENCES [budget].[Project] ([Id])
);


GO

