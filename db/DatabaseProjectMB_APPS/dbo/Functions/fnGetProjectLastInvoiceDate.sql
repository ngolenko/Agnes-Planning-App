-- =============================================
-- Author:		<Author,,Name>
-- Create date: <Create Date, ,>
-- Description:	<Description, ,>
-- =============================================
CREATE FUNCTION fnGetProjectLastInvoiceDate
(
	-- Add the parameters for the function here
	@ProjectId int
)
RETURNS date
AS
BEGIN
	declare @result DATE
	SELECT @result=MAX(InvoiceDate) FROM budget.Invoice WHERE ProjectId = @ProjectId
	 
	 RETURN @result
END

GO

